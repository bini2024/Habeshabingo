import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, onSnapshot, collection, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, playSound } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = firebaseConfig.appId;
let userId = null;

// --- BINGO LETTER HELPER ---
function getBingoLetter(num) {
    if (num === 'FREE' || typeof num !== 'number') return '';
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

function formatBall(num) {
    if (num === 'FREE' || typeof num !== 'number') return num;
    return `${getBingoLetter(num)}-${num}`;
}

// --- CALLER SPEECH API ---
let isCallerEnabled = true;
const callerToggle = document.getElementById('caller-toggle');

callerToggle.addEventListener('change', (e) => {
    isCallerEnabled = e.target.checked;
});
callerToggle.checked = isCallerEnabled;

function speakNumber(number) {
    if (!isCallerEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const letter = getBingoLetter(number);
    const utterance = new SpeechSynthesisUtterance(`${letter} ${number}`);
    utterance.pitch = 1.05;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

// --- UI Element References ---
const toastContainer = document.getElementById('toast-container');
const loadingSpinner = document.getElementById('loading-spinner');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalOkBtn = document.getElementById('modal-ok-btn');

const claimModalContainer = document.getElementById('claim-modal-container');
const claimModalTitle = document.getElementById('claim-modal-title');
const claimVerificationBadge = document.getElementById('claim-verification-badge');
const claimModalCard = document.getElementById('claim-modal-card');
const claimCalledCount = document.getElementById('claim-called-count');
const claimModalCalledNumbers = document.getElementById('claim-modal-called-numbers');
const claimRejectBtn = document.getElementById('claim-reject-btn');
const claimApproveBtn = document.getElementById('claim-approve-btn');
let currentClaimId = null;
let currentClaimData = null;

const authInfo = document.getElementById('auth-info');
const gameSetupArea = document.getElementById('game-setup-area');
const usernameInput = document.getElementById('username-input');
const gameIdInput = document.getElementById('game-id-input');
const feeInput = document.getElementById('fee-input');
const paymentInput = document.getElementById('payment-input');

const joinGameBtn = document.getElementById('join-game-btn');
const createGameBtn = document.getElementById('create-game-btn');
const hostSetupDiv = document.getElementById('host-setup');
const gameArea = document.getElementById('game-area');
const gameStateDiv = document.getElementById('game-state');
const currentGameIdDisplay = document.getElementById('current-game-id');
const gameStatusBadge = document.getElementById('game-status-badge');
const copyIdBtn = document.getElementById('copy-id-btn');
const lobbyPaymentDisplay = document.getElementById('lobby-payment-display');
const paymentInfoText = document.getElementById('payment-info-text');

const hostViewDiv = document.getElementById('host-view');
const hostLobbyView = document.getElementById('host-lobby-view');
const hostInGameView = document.getElementById('host-in-game-view');
const playersUl = document.getElementById('players-ul');
const playerCountSpan = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');
const drawNumberBtn = document.getElementById('draw-number-btn');
const lastCalledNumberDisplay = document.getElementById('last-called-number');
const hostCalledCounter = document.getElementById('host-called-counter');
const calledNumbersDisplay = document.getElementById('called-numbers-display');
const claimsUl = document.getElementById('claims-ul');
const endGameBtn = document.getElementById('end-game-btn');

const playerViewDiv = document.getElementById('player-view');
const playerLobbyView = document.getElementById('player-lobby-view');
const playerInGameView = document.getElementById('player-in-game-view');
const playersUlPlayer = document.getElementById('players-ul-player');
const lastCalledNumberPlayerDisplay = document.getElementById('last-called-number-player');
const playerCalledCount = document.getElementById('player-called-count');
const recentCallsPlayer = document.getElementById('recent-calls-player');
const bingoCardContainer = document.getElementById('bingo-card');
const generateCardBtn = document.getElementById('generate-card-btn');
const bingoActionWrapper = document.getElementById('bingo-action-wrapper');
const bingoBtn = document.getElementById('bingo-btn');
const leaveGameBtn = document.getElementById('leave-game-btn');

const gameInfoDiv = document.getElementById('game-info');
const feeDisplay = document.getElementById('fee-display');
const prizeAmountDisplay = document.getElementById('prize-amount');

const joinRequestsList = document.getElementById('join-requests-list');
const playerLobbyTitle = document.getElementById('player-lobby-title');
const playerWaitingMessage = document.getElementById('player-waiting-message');
const cancelJoinRequestBtn = document.getElementById('cancel-join-request-btn');

// --- Game State Variables ---
let gameId = null;
let gameStatus = 'waiting';
let isHost = false;
let isHostUser = false;
let gameCard = null;
let calledNumbers = [];
let markedNumbers = new Set(['FREE']);
let unsubscribeGameListener;
let unsubscribeClaimsListener;
let unsubscribePlayersListener;
let unsubscribeJoinRequestsListener;
let myJoinRequestId = null;

// --- Toast & Modal Helpers ---
function showToast(message, type = 'info') {
    const colors = {
        info: 'bg-slate-800 border-blue-500/50 text-blue-200',
        success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
        warning: 'bg-amber-950/90 border-amber-500/50 text-amber-200',
        error: 'bg-rose-950/90 border-rose-500/50 text-rose-200'
    };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md text-xs sm:text-sm font-semibold fade-in ${colors[type] || colors.info}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 2600);
}

function showModal(title, message, isHtml = false) {
    modalTitle.textContent = title;
    if (isHtml) {
        modalMessage.innerHTML = message;
    } else {
        modalMessage.textContent = message;
    }
    modalContainer.classList.remove('hidden');
}

modalOkBtn.addEventListener('click', () => {
    modalContainer.classList.add('hidden');
});

// Copy Game ID
if (copyIdBtn) {
    copyIdBtn.addEventListener('click', () => {
        if (gameId) {
            navigator.clipboard.writeText(gameId);
            showToast(`Copied room code: ${gameId}`, 'success');
            const originalIcon = copyIdBtn.innerHTML;
            copyIdBtn.innerHTML = '<i class="fas fa-check text-emerald-400"></i>';
            setTimeout(() => (copyIdBtn.innerHTML = originalIcon), 2000);
        }
    });
}

// --- LocalStorage Card Persistence ---
function saveCardState() {
    if (!gameId || !gameCard) return;
    localStorage.setItem(`habesha_bingo_${gameId}`, JSON.stringify({
        card: gameCard,
        marked: Array.from(markedNumbers)
    }));
}

function loadCardState(targetGameId) {
    try {
        const raw = localStorage.getItem(`habesha_bingo_${targetGameId}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.card)) {
            gameCard = parsed.card;
            markedNumbers = new Set(parsed.marked || ['FREE']);
            markedNumbers.add('FREE');
            return true;
        }
    } catch (e) {
        console.warn('Could not restore saved card:', e);
    }
    return false;
}

// --- Bingo Card Generation & Rendering ---
function generateUniqueNumbers(count, min, max) {
    const numbers = new Set();
    while (numbers.size < count) {
        numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numbers);
}

function createBingoCard(silent = false) {
    if (gameStatus === 'in-progress') {
        showToast('Game is already in progress! Card is locked.', 'warning');
        return;
    }

    gameCard = [
        generateUniqueNumbers(5, 1, 15),
        generateUniqueNumbers(5, 16, 30),
        generateUniqueNumbers(5, 31, 45),
        generateUniqueNumbers(5, 46, 60),
        generateUniqueNumbers(5, 61, 75)
    ];
    gameCard[2][2] = 'FREE';
    markedNumbers.clear();
    markedNumbers.add('FREE');
    saveCardState();
    renderBingoCard();

    if (!silent) {
        playSound('MARK');
        showToast('Generated a fresh Bingo card!', 'success');
    }
}

function renderBingoCard() {
    if (!gameCard) return;
    bingoCardContainer.innerHTML = '';
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');
            const number = gameCard[col][row];
            cell.textContent = number;
            if (number === 'FREE') {
                cell.classList.add('free');
            }
            if (markedNumbers.has(number)) {
                cell.classList.add('marked');
            }
            cell.addEventListener('click', () => toggleMarked(number, cell));
            bingoCardContainer.appendChild(cell);
        }
    }
}

function toggleMarked(number, cell) {
    if (number === 'FREE') return;

    if (gameStatus !== 'in-progress') {
        showToast('Wait for the host to start the game!', 'info');
        return;
    }

    if (calledNumbers.includes(number)) {
        playSound('MARK');
        if (markedNumbers.has(number)) {
            markedNumbers.delete(number);
            cell.classList.remove('marked');
        } else {
            markedNumbers.add(number);
            cell.classList.add('marked');
        }
        saveCardState();
    } else {
        showToast(`${formatBall(number)} hasn't been called yet!`, 'warning');
    }
}

// --- Winning Pattern Detection (Returns Winning Coordinates) ---
function getWinningCells(cardMatrix, validSet) {
    if (!cardMatrix) return null;

    // Check 5 Rows
    for (let row = 0; row < 5; row++) {
        const coords = [0, 1, 2, 3, 4].map(col => [col, row]);
        if (coords.every(([c, r]) => validSet.has(cardMatrix[c][r]))) {
            return { type: `Row ${row + 1}`, coords };
        }
    }

    // Check 5 Columns
    const colLetters = ['B', 'I', 'N', 'G', 'O'];
    for (let col = 0; col < 5; col++) {
        const coords = [0, 1, 2, 3, 4].map(row => [col, row]);
        if (coords.every(([c, r]) => validSet.has(cardMatrix[c][r]))) {
            return { type: `Column ${colLetters[col]}`, coords };
        }
    }

    // Check Main Diagonal
    const diag1 = [0, 1, 2, 3, 4].map(i => [i, i]);
    if (diag1.every(([c, r]) => validSet.has(cardMatrix[c][r]))) {
        return { type: 'Diagonal', coords: diag1 };
    }

    // Check Anti-Diagonal
    const diag2 = [0, 1, 2, 3, 4].map(i => [i, 4 - i]);
    if (diag2.every(([c, r]) => validSet.has(cardMatrix[c][r]))) {
        return { type: 'Diagonal', coords: diag2 };
    }

    // Check 4 Corners
    const corners = [[0, 0], [4, 0], [0, 4], [4, 4]];
    if (corners.every(([c, r]) => validSet.has(cardMatrix[c][r]))) {
        return { type: '4 Corners', coords: corners };
    }

    return null;
}

function checkBingo() {
    return Boolean(getWinningCells(gameCard, markedNumbers));
}

function renderCalledNumbers(numbers) {
    calledNumbersDisplay.innerHTML = '';
    hostCalledCounter.textContent = `${numbers.length} / 75`;
    playerCalledCount.textContent = `${numbers.length} / 75 called`;

    numbers.forEach((num, idx) => {
        const numberBall = document.createElement('div');
        numberBall.classList.add('number-ball', 'fade-in');
        if (idx === numbers.length - 1) {
            numberBall.classList.add('latest-ball');
        }
        numberBall.textContent = formatBall(num);
        calledNumbersDisplay.appendChild(numberBall);
    });

    if (numbers.length > 0) {
        const lastNum = numbers[numbers.length - 1];
        const formatted = formatBall(lastNum);
        lastCalledNumberDisplay.textContent = formatted;
        lastCalledNumberPlayerDisplay.textContent = formatted;

        // Render last 5 called balls for player
        recentCallsPlayer.innerHTML = '';
        const recent = numbers.slice(-6, -1).reverse();
        if (recent.length === 0) {
            recentCallsPlayer.innerHTML = '<span class="text-xs text-slate-500">First ball drawn</span>';
        } else {
            recent.forEach(num => {
                const badge = document.createElement('span');
                badge.className = 'px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200';
                badge.textContent = formatBall(num);
                recentCallsPlayer.appendChild(badge);
            });
        }
    } else {
        lastCalledNumberDisplay.textContent = '--';
        lastCalledNumberPlayerDisplay.textContent = '--';
        recentCallsPlayer.innerHTML = '<span class="text-xs text-slate-500 italic">No balls drawn yet</span>';
    }
}

// --- Firebase Operations ---
async function approvePlayer(requestId, playerUserId, playerUsername) {
    if (!isHost) return;
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players', playerUserId);
    try {
        await setDoc(playerRef, {
            userId: playerUserId,
            username: playerUsername,
            joinedAt: new Date()
        });
        await rejectPlayer(requestId);
        showToast(`Approved ${playerUsername}`, 'success');
    } catch (error) {
        console.error("Error approving player: ", error);
        showModal('Error', `Failed to approve player: ${error.message}`);
    }
}

async function rejectPlayer(requestId) {
    if (!isHost) return;
    const requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests', requestId);
    try {
        await deleteDoc(requestRef);
    } catch (error) {
        console.error("Error rejecting player: ", error);
        showModal('Error', `Failed to reject player: ${error.message}`);
    }
}

async function requestToJoinGame() {
    const username = usernameInput.value.trim();
    if (!username) {
        showModal('Name Required', 'Please enter your name.');
        return;
    }

    const requestRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests');
    try {
        myJoinRequestId = userId;
        const requestDocRef = doc(requestRef, myJoinRequestId);
        await setDoc(requestDocRef, {
            userId: userId,
            username: username,
            requestedAt: new Date()
        });
        playerWaitingMessage.classList.remove('hidden');
    } catch (error) {
        console.error("Error requesting to join: ", error);
        showModal('Error', `Failed to send join request: ${error.message}`);
    }
}

async function cancelJoinRequest() {
    if (!gameId || !myJoinRequestId) return;
    const requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests', myJoinRequestId);
    try {
        await deleteDoc(requestRef);
        playerWaitingMessage.classList.add('hidden');
        myJoinRequestId = null;
        showToast('Join request cancelled', 'info');
    } catch (error) {
        console.error("Error cancelling request: ", error);
    }
}

async function createGame() {
    if (!isHostUser) {
        showModal('Error', 'You do not have host permissions to create a game.');
        return;
    }

    const newGameId = `BINGO-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const fee = parseFloat(feeInput.value);
    const paymentInfo = paymentInput.value.trim();

    if (isNaN(fee) || fee <= 0) {
        showModal('Missing Fee', 'Please enter a valid entry fee per player.');
        return;
    }
    if (!paymentInfo) {
        showModal('Missing Payment Info', 'Please enter your E-Transfer email or phone number.');
        return;
    }

    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', newGameId);
    try {
        await setDoc(gameRef, {
            hostId: userId,
            fee: fee,
            paymentInfo: paymentInfo,
            calledNumbers: [],
            createdAt: new Date(),
            status: 'waiting'
        });
        gameId = newGameId;
        isHost = true;
        showGameUI();
        listenForGameUpdates();
        showToast(`Room ${gameId} created!`, 'success');
    } catch (error) {
        console.error("Error creating game: ", error);
        showModal('Error', `Failed to create a new game: ${error.message}`);
    }
}

async function joinGame() {
    const username = usernameInput.value.trim();
    const inputId = gameIdInput.value.trim().toUpperCase();

    if (!username) {
        showModal('Name Required', 'Please enter your name before joining.');
        return;
    }
    if (!inputId) {
        showModal('Invalid Room Code', 'Please enter a valid Room Code.');
        return;
    }

    localStorage.setItem('habesha_bingo_username', username);

    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', inputId);
    try {
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            gameId = inputId;
            const gameData = gameDoc.data();

            if (gameData.hostId === userId) {
                isHost = true;
                showGameUI();
                listenForGameUpdates();
            } else {
                isHost = false;
                showGameUI();
                listenForGameUpdates();

                // Check if player is already approved in this room
                const playerDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players', userId));
                if (!playerDoc.exists()) {
                    await requestToJoinGame();
                }
            }
        } else {
            showModal('Room Not Found', 'No active game found with that Room Code.');
        }
    } catch (error) {
        console.error("Error joining game: ", error);
        showModal('Error', `Failed to join the game: ${error.message}`);
    }
}

function listenForGameUpdates() {
    if (unsubscribeGameListener) unsubscribeGameListener();
    if (unsubscribeClaimsListener) unsubscribeClaimsListener();
    if (unsubscribePlayersListener) unsubscribePlayersListener();
    if (unsubscribeJoinRequestsListener) unsubscribeJoinRequestsListener();

    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    unsubscribeGameListener = onSnapshot(gameRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            gameStatus = data.status;

            if (data.paymentInfo && lobbyPaymentDisplay && paymentInfoText) {
                lobbyPaymentDisplay.classList.remove('hidden');
                paymentInfoText.textContent = data.paymentInfo;
            }

            const newCalledNumbers = data.calledNumbers || [];
            if (newCalledNumbers.length > calledNumbers.length) {
                const lastNumber = newCalledNumbers[newCalledNumbers.length - 1];
                playSound('DRAW');
                if (isHost) {
                    speakNumber(lastNumber);
                }
            }

            calledNumbers = newCalledNumbers;
            renderCalledNumbers(calledNumbers);

            // Always show Prize Pool & Rules in Lobby and In-Game
            gameInfoDiv.classList.remove('hidden');

            if (data.status === 'in-progress') {
                gameStatusBadge.textContent = 'Live In-Game';
                gameStatusBadge.className = 'text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                hostLobbyView.classList.add('hidden');
                hostInGameView.classList.remove('hidden');
                playerLobbyView.classList.add('hidden');
                playerInGameView.classList.remove('hidden');
                bingoActionWrapper.classList.remove('hidden');
            } else if (data.status === 'waiting') {
                gameStatusBadge.textContent = 'Lobby Open';
                gameStatusBadge.className = 'text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30';
                hostLobbyView.classList.remove('hidden');
                hostInGameView.classList.add('hidden');
                playerLobbyView.classList.remove('hidden');
                playerInGameView.classList.add('hidden');
                bingoActionWrapper.classList.add('hidden');
            } else if (data.status === 'finished') {
                playSound('BINGO');
                confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
                const prizeText = data.finalPrize ? ` ($${Number(data.finalPrize).toFixed(2)} Prize)` : '';
                showModal('Winner Announced!', `🎉 ${data.winner} won the Bingo game${prizeText}!`);
                modalOkBtn.onclick = () => {
                    modalContainer.classList.add('hidden');
                    resetGame();
                    modalOkBtn.onclick = () => modalContainer.classList.add('hidden');
                };
            } else if (data.status === 'cancelled') {
                showModal('Game Cancelled', 'The host has ended the game.');
                resetGame();
            }
        } else {
            showModal('Game Closed', 'The game room was closed.');
            resetGame();
        }
    }, (error) => {
        console.error("Error listening to game updates:", error);
    });

    const claimsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'claims');
    unsubscribeClaimsListener = onSnapshot(claimsRef, (querySnapshot) => {
        claimsUl.innerHTML = '';
        const claims = [];
        querySnapshot.forEach((docSnap) => {
            claims.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (claims.length === 0) {
            claimsUl.innerHTML = '<li class="text-xs text-slate-400 italic">No active claims yet.</li>';
            return;
        }

        if (isHost) playSound('BINGO');

        claims.forEach(claim => {
            const listItem = document.createElement('li');
            const claimButton = document.createElement('button');
            claimButton.className = 'w-full bg-rose-600 hover:bg-rose-500 text-white text-left px-4 py-2.5 rounded-xl font-semibold flex items-center justify-between transition-all shadow-md';
            claimButton.innerHTML = `
                <span><i class="fas fa-trophy text-amber-300 mr-2"></i><strong>${claim.username}</strong> claimed BINGO!</span>
                <span class="text-xs bg-white/20 px-2.5 py-1 rounded-lg font-bold">Verify →</span>
            `;
            claimButton.addEventListener('click', () => showClaimModal(claim, claim.id));
            listItem.appendChild(claimButton);
            claimsUl.appendChild(listItem);
        });
    });

    const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players');
    unsubscribePlayersListener = onSnapshot(playersRef, (querySnapshot) => {
        playersUl.innerHTML = '';
        playersUlPlayer.innerHTML = '';
        const players = [];
        let playerIsApproved = false;

        querySnapshot.forEach((docSnap) => {
            const playerData = docSnap.data();
            players.push(playerData);
            if (playerData.userId === userId) {
                playerIsApproved = true;
            }
        });

        playerCountSpan.textContent = players.length;

        if (players.length === 0) {
            playersUl.innerHTML = '<li class="col-span-full text-xs text-slate-500 italic">No players approved yet.</li>';
            playersUlPlayer.innerHTML = '<li class="col-span-full text-xs text-slate-500 italic">Waiting for players...</li>';
        } else {
            players.forEach(player => {
                const badgeClass = 'px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-medium truncate flex items-center space-x-1.5';
                const liHost = document.createElement('li');
                liHost.className = badgeClass;
                liHost.innerHTML = `<i class="fas fa-user-check text-emerald-400 text-xs"></i><span class="truncate">${player.username}</span>`;
                playersUl.appendChild(liHost);

                const liPlayer = liHost.cloneNode(true);
                playersUlPlayer.appendChild(liPlayer);
            });
        }

        if (!isHost && playerIsApproved) {
            playerWaitingMessage.classList.add('hidden');
            playerLobbyTitle.innerHTML = '<i class="fas fa-check-circle text-emerald-400"></i><span>Approved! Ready for Host</span>';
            myJoinRequestId = null;
        }

        const gameDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
        getDoc(gameDocRef).then(docSnapshot => {
            if (!docSnapshot.exists()) return;
            const fee = docSnapshot.data().fee || 0;
            const prize = (players.length * fee) * 0.8;
            feeDisplay.textContent = `Entry Fee: $${fee.toFixed(2)} / player`;
            prizeAmountDisplay.textContent = `$${prize.toFixed(2)}`;
        });
    });

    if (isHost) {
        const requestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests');
        unsubscribeJoinRequestsListener = onSnapshot(requestsRef, (querySnapshot) => {
            joinRequestsList.innerHTML = '';
            if (querySnapshot.empty) {
                joinRequestsList.innerHTML = '<li class="text-xs text-slate-500 italic">No pending requests.</li>';
                return;
            }
            querySnapshot.forEach((docSnap) => {
                const request = docSnap.data();
                const requestId = docSnap.id;

                const li = document.createElement('li');
                li.className = 'flex items-center justify-between bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800';

                const usernameSpan = document.createElement('span');
                usernameSpan.className = 'font-semibold text-white';
                usernameSpan.textContent = request.username;
                li.appendChild(usernameSpan);

                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex items-center space-x-2';

                const approveBtn = document.createElement('button');
                approveBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Approve';
                approveBtn.className = 'bg-emerald-600 hover:bg-emerald-500 text-white py-1 px-3 text-xs font-bold rounded-lg transition-all';
                approveBtn.onclick = () => approvePlayer(requestId, request.userId, request.username);
                buttonsDiv.appendChild(approveBtn);

                const rejectBtn = document.createElement('button');
                rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
                rejectBtn.className = 'bg-rose-600/80 hover:bg-rose-600 text-white py-1 px-2.5 text-xs font-bold rounded-lg transition-all';
                rejectBtn.onclick = () => rejectPlayer(requestId);
                buttonsDiv.appendChild(rejectBtn);

                li.appendChild(buttonsDiv);
                joinRequestsList.appendChild(li);
            });
        });
    }
}

async function startGame() {
    if (!isHost) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    try {
        await setDoc(gameRef, { status: 'in-progress' }, { merge: true });
        showToast('Game started! Draw the first ball.', 'success');
    } catch (error) {
        console.error("Error starting game: ", error);
        showModal('Error', `Failed to start the game: ${error.message}`);
    }
}

async function drawNumber() {
    if (!isHost) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    try {
        const gameDoc = await getDoc(gameRef);
        const data = gameDoc.data();
        if (data.status !== 'in-progress') {
            showToast('Please start the game first!', 'warning');
            return;
        }
        const currentCalledNumbers = data.calledNumbers || [];
        const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
        const remainingNumbers = allNumbers.filter(num => !currentCalledNumbers.includes(num));

        if (remainingNumbers.length > 0) {
            drawNumberBtn.disabled = true;
            drawNumberBtn.classList.add('opacity-50', 'cursor-not-allowed');
            lastCalledNumberDisplay.classList.add('rolling');
            lastCalledNumberDisplay.textContent = '...';

            setTimeout(async () => {
                const newNumber = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
                lastCalledNumberDisplay.classList.remove('rolling');
                lastCalledNumberDisplay.textContent = formatBall(newNumber);

                await setDoc(gameRef, {
                    calledNumbers: [...currentCalledNumbers, newNumber]
                }, { merge: true });

                drawNumberBtn.disabled = false;
                drawNumberBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }, 700);
        } else {
            showModal('All Balls Drawn', 'All 75 numbers have been called!');
        }
    } catch (error) {
        console.error("Error drawing number: ", error);
        showModal('Error', `Failed to draw a new number: ${error.message}`);
        drawNumberBtn.disabled = false;
        drawNumberBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        lastCalledNumberDisplay.classList.remove('rolling');
    }
}

async function claimBingo() {
    const username = usernameInput.value.trim() || localStorage.getItem('habesha_bingo_username') || 'Player';
    if (!gameCard) {
        showToast('Generate a Bingo card first!', 'warning');
        return;
    }
    const winResult = getWinningCells(gameCard, markedNumbers);
    if (winResult) {
        playSound('BINGO');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        const claimsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'claims');
        try {
            await addDoc(claimsRef, {
                userId: userId,
                username: username,
                pattern: winResult.type,
                claimedAt: new Date(),
                card: JSON.stringify(gameCard)
            });
            showModal('BINGO CLAIM SENT!', `Your ${winResult.type} Bingo claim has been sent to the host for verification!`);
        } catch (error) {
            console.error("Error claiming bingo:", error);
            showModal('Error', `Failed to claim Bingo: ${error.message}`);
        }
    } else {
        showToast('No complete winning pattern marked yet! Keep going.', 'warning');
    }
}

async function endGame() {
    if (!isHost) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    try {
        await setDoc(gameRef, {
            status: 'cancelled',
            finishedAt: new Date()
        }, { merge: true });
    } catch (error) {
        console.error("Error ending game: ", error);
        showModal('Error', `Failed to end the game: ${error.message}`);
    }
}

async function leaveGame() {
    if (gameId && userId) {
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players', userId);
        try {
            await deleteDoc(playerRef);
        } catch (error) {
            console.error("Error leaving game: ", error);
        }
    }
    if (myJoinRequestId) {
        await cancelJoinRequest();
    }
    resetGame();
    showToast('You left the room', 'info');
}

function showClaimModal(claimData, claimId) {
    currentClaimId = claimId;
    currentClaimData = claimData;

    claimModalTitle.textContent = `Verify: ${claimData.username}`;
    const card = JSON.parse(claimData.card);

    // Build set of genuinely called numbers + FREE space
    const validCalledSet = new Set([...calledNumbers, 'FREE']);
    const winCheck = getWinningCells(card, validCalledSet);
    const winningCoordSet = new Set(
        winCheck ? winCheck.coords.map(([c, r]) => `${c},${r}`) : []
    );

    if (winCheck) {
        claimVerificationBadge.innerHTML = `
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <i class="fas fa-check-circle mr-1.5"></i> Valid Bingo (${winCheck.type})
            </span>`;
    } else {
        claimVerificationBadge.innerHTML = `
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <i class="fas fa-exclamation-triangle mr-1.5"></i> No Valid Pattern Found
            </span>`;
    }

    claimModalCard.innerHTML = '';
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');
            const number = card[col][row];
            cell.textContent = number;
            if (number === 'FREE') {
                cell.classList.add('free');
            }
            if (validCalledSet.has(number)) {
                cell.classList.add('marked');
            }
            if (winningCoordSet.has(`${col},${row}`)) {
                cell.classList.add('winning-cell');
            }
            claimModalCard.appendChild(cell);
        }
    }

    claimCalledCount.textContent = calledNumbers.length;
    claimModalCalledNumbers.innerHTML = '';
    calledNumbers.forEach(num => {
        const numberBall = document.createElement('div');
        numberBall.classList.add('number-ball');
        numberBall.textContent = formatBall(num);
        claimModalCalledNumbers.appendChild(numberBall);
    });

    claimModalContainer.classList.remove('hidden');
}

async function approveWinner() {
    if (!isHost || !currentClaimData) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);

    try {
        const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players');
        const playersSnapshot = await getDocs(playersRef);
        const playerCount = playersSnapshot.size;

        const gameDoc = await getDoc(gameRef);
        const fee = gameDoc.data().fee || 0;
        const prize = (playerCount * fee) * 0.8;
        const houseCut = (playerCount * fee) - prize;

        await setDoc(gameRef, {
            status: 'finished',
            winner: currentClaimData.username,
            finishedAt: new Date(),
            finalPlayerCount: playerCount,
            finalPrize: prize,
            finalHouseCut: houseCut
        }, { merge: true });

        claimModalContainer.classList.add('hidden');
    } catch (error) {
        console.error("Error approving winner: ", error);
        showModal('Error', `Failed to approve winner: ${error.message}`);
    }
}

async function rejectClaim() {
    if (!isHost || !currentClaimId) return;
    const claimRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'claims', currentClaimId);
    try {
        await deleteDoc(claimRef);
        claimModalContainer.classList.add('hidden');
        showToast('Claim rejected and removed', 'info');
    } catch (error) {
        console.error("Error rejecting claim: ", error);
        showModal('Error', `Failed to reject claim: ${error.message}`);
    }
}

function showGameUI() {
    gameSetupArea.classList.add('hidden');
    gameArea.classList.remove('hidden');
    gameStateDiv.classList.remove('hidden');
    currentGameIdDisplay.textContent = gameId;
    gameInfoDiv.classList.remove('hidden');

    if (isHost) {
        hostViewDiv.classList.remove('hidden');
        playerViewDiv.classList.add('hidden');
        hostLobbyView.classList.remove('hidden');
        hostInGameView.classList.add('hidden');
    } else {
        hostViewDiv.classList.add('hidden');
        playerViewDiv.classList.remove('hidden');
        playerLobbyView.classList.remove('hidden');
        playerInGameView.classList.add('hidden');

        // Restore saved card for this room or create a fresh one
        if (!loadCardState(gameId)) {
            createBingoCard(true);
        } else {
            renderBingoCard();
        }
    }
}

createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
startGameBtn.addEventListener('click', startGame);
drawNumberBtn.addEventListener('click', drawNumber);
endGameBtn.addEventListener('click', endGame);
leaveGameBtn.addEventListener('click', leaveGame);
generateCardBtn.addEventListener('click', () => createBingoCard(false));
bingoBtn.addEventListener('click', claimBingo);

claimApproveBtn.addEventListener('click', approveWinner);
claimRejectBtn.addEventListener('click', rejectClaim);
cancelJoinRequestBtn.addEventListener('click', cancelJoinRequest);

function resetGame() {
    if (unsubscribeGameListener) unsubscribeGameListener();
    if (unsubscribeClaimsListener) unsubscribeClaimsListener();
    if (unsubscribePlayersListener) unsubscribePlayersListener();
    if (unsubscribeJoinRequestsListener) unsubscribeJoinRequestsListener();

    gameStateDiv.classList.add('hidden');
    hostViewDiv.classList.add('hidden');
    playerViewDiv.classList.add('hidden');
    gameArea.classList.add('hidden');
    gameSetupArea.classList.remove('hidden');
    gameCard = null;
    markedNumbers = new Set(['FREE']);
    gameId = null;
    gameStatus = 'waiting';
    isHost = false;
    calledNumbers = [];
    renderCalledNumbers([]);
    bingoCardContainer.innerHTML = '';
    gameIdInput.value = '';
    lobbyPaymentDisplay.classList.add('hidden');

    myJoinRequestId = null;
    playerWaitingMessage.classList.add('hidden');
    playerLobbyTitle.innerHTML = '<i class="fas fa-hourglass-half animate-spin text-sm"></i><span>Waiting for Host...</span>';

    if (!isHostUser) {
        createGameBtn.classList.add('hidden');
        hostSetupDiv.classList.add('hidden');
    }
}

// --- Initialization ---
window.onload = async function () {
    loadingSpinner.classList.remove('hidden');
    const savedName = localStorage.getItem('habesha_bingo_username');
    if (savedName && usernameInput) {
        usernameInput.value = savedName;
    }

    try {
        await signInAnonymously(auth);
        userId = auth.currentUser.uid;
        authInfo.textContent = `User ID: ${userId}`;

        try {
            const hostRef = doc(db, 'hosts', userId);
            const hostDoc = await getDoc(hostRef);
            if (hostDoc.exists()) {
                isHostUser = true;
                createGameBtn.classList.remove('hidden');
                hostSetupDiv.classList.remove('hidden');
                authInfo.textContent += ' (HOST)';
            }
        } catch (e) {
            console.error("Error checking host status: ", e);
        }
    } catch (error) {
        console.error("Authentication error: ", error);
        showModal('Authentication Error', `Failed to authenticate with Firebase: ${error.message}`);
    } finally {
        loadingSpinner.classList.add('hidden');
    }
};

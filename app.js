import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, onSnapshot, collection, deleteDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import Config from the other file
import { firebaseConfig, AUDIO_DATA } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = firebaseConfig.appId;
let userId = null;

// --- SOUND EFFECTS ---
const drawNumberSound = new Audio(AUDIO_DATA.DRAW);
const markCellSound = new Audio(AUDIO_DATA.MARK);
const bingoSound = new Audio(AUDIO_DATA.BINGO);

// --- CALLER API ---
let isCallerEnabled = true;
const callerToggle = document.getElementById('caller-toggle');

callerToggle.addEventListener('change', (e) => {
    isCallerEnabled = e.target.checked;
});
callerToggle.checked = isCallerEnabled;

function speakNumber(number) {
    if (!isCallerEnabled) return;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`${number}`);
        utterance.pitch = 1;
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Web Speech API is not supported in this browser.');
    }
}

// --- UI Element References ---
const loadingSpinner = document.getElementById('loading-spinner');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalOkBtn = document.getElementById('modal-ok-btn');

const claimModalContainer = document.getElementById('claim-modal-container');
const claimModalTitle = document.getElementById('claim-modal-title');
const claimModalCard = document.getElementById('claim-modal-card');
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
const joinGameBtn = document.getElementById('join-game-btn');
const createGameBtn = document.getElementById('create-game-btn');
const hostSetupDiv = document.getElementById('host-setup');
const gameArea = document.getElementById('game-area');
const gameStateDiv = document.getElementById('game-state');
const currentGameIdDisplay = document.getElementById('current-game-id');
const hostViewDiv = document.getElementById('host-view');
const hostLobbyView = document.getElementById('host-lobby-view');
const hostInGameView = document.getElementById('host-in-game-view');
const playersUl = document.getElementById('players-ul');
const playerCountSpan = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');
const drawNumberBtn = document.getElementById('draw-number-btn');
const lastCalledNumberDisplay = document.getElementById('last-called-number');
const calledNumbersDisplay = document.getElementById('called-numbers-display');
const claimsUl = document.getElementById('claims-ul');
const endGameBtn = document.getElementById('end-game-btn');
const playerViewDiv = document.getElementById('player-view');
const playerLobbyView = document.getElementById('player-lobby-view');
const playerInGameView = document.getElementById('player-in-game-view');
const playersUlPlayer = document.getElementById('players-ul-player');
const lastCalledNumberPlayerDisplay = document.getElementById('last-called-number-player');
const bingoCardContainer = document.getElementById('bingo-card');
const generateCardBtn = document.getElementById('generate-card-btn');
const bingoBtn = document.getElementById('bingo-btn');
const leaveGameBtn = document.getElementById('leave-game-btn');
const leaveGameBtnLobby = document.getElementById('leave-game-btn-lobby');
const gameInfoDiv = document.getElementById('game-info');
const rulesViewDiv = document.getElementById('rules-view');
const prizeViewDiv = document.getElementById('prize-view');
const feeDisplay = document.getElementById('fee-display');
const prizeAmountDisplay = document.getElementById('prize-amount');

// Waiting Room UI
const joinRequestsList = document.getElementById('join-requests-list');
const playerLobbyTitle = document.getElementById('player-lobby-title');
const playerWaitingMessage = document.getElementById('player-waiting-message');
const cancelJoinRequestBtn = document.getElementById('cancel-join-request-btn');

// --- Game state variables ---
let gameId = null;
let isHost = false; 
let isHostUser = false;
let gameCard = null;
let calledNumbers = [];
let markedNumbers = new Set();
let unsubscribeGameListener;
let unsubscribeClaimsListener;
let unsubscribePlayersListener;
let unsubscribeJoinRequestsListener;
let myJoinRequestId = null; 

// --- Utility Functions ---
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

function generateUniqueNumbers(count, min, max) {
    const numbers = new Set();
    while (numbers.size < count) {
        numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numbers);
}

function createBingoCard() {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    getDoc(gameRef).then(gameDoc => {
        if (gameDoc.exists() && gameDoc.data().status === 'in-progress') {
            showModal('Cannot Generate Card', 'The game has already started. You cannot generate a new card.');
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
        renderBingoCard();
        showModal('Card Generated!', 'Your unique Bingo card is ready. Good luck!');
    });
}

function renderBingoCard() {
    bingoCardContainer.innerHTML = '';
    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');
            const number = gameCard[i][j];
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
    markCellSound.play().catch(e => console.error("Sound playback failed:", e));
    const isNumberOnCard = gameCard.flat().includes(number);
    const isCalled = calledNumbers.includes(number);

    if (!isNumberOnCard && number !== 'FREE') {
        showModal('Invalid Action', 'This number is not on your card.');
        return;
    }
    if (isCalled || number === 'FREE') {
        if (markedNumbers.has(number)) {
            markedNumbers.delete(number);
            cell.classList.remove('marked');
        } else {
            markedNumbers.add(number);
            cell.classList.add('marked');
        }
    } else {
        showModal('Invalid Action', 'This number has not been called yet!');
    }
}

function checkBingo() {
    if (!gameCard) return false;
    
    const lines = [];
    for (let j = 0; j < 5; j++) lines.push(gameCard.map(col => col[j])); // Rows
    lines.push(...gameCard); // Columns
    lines.push(gameCard.map((col, i) => col[i])); // Diag 1
    lines.push(gameCard.map((col, i) => col[4 - i])); // Diag 2
    
    return lines.some(line => line.every(num => markedNumbers.has(num)));
}

function renderCalledNumbers(numbers) {
    calledNumbersDisplay.innerHTML = '';
    numbers.forEach(num => {
        const numberBall = document.createElement('div');
        numberBall.classList.add('number-ball', 'called-number', 'fade-in');
        numberBall.textContent = num;
        calledNumbersDisplay.appendChild(numberBall);
    });
    if (numbers.length > 0) {
        const lastNum = numbers[numbers.length - 1];
        lastCalledNumberDisplay.textContent = lastNum;
        lastCalledNumberPlayerDisplay.textContent = lastNum;
    } else {
        lastCalledNumberDisplay.textContent = '--';
        lastCalledNumberPlayerDisplay.textContent = '--';
    }
}

// --- Firebase Integration ---

async function approvePlayer(requestId, playerUserId, playerUsername) {
    if (!isHost) return;
    
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players', playerUserId);
    try {
        await setDoc(playerRef, {
            userId: playerUserId,
            username: playerUsername,
            joinedAt: new Date(),
        });
        await rejectPlayer(requestId); 
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
        showModal('Username Required', 'Please enter a username.');
        return;
    }
    
    const requestRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests');
    try {
        myJoinRequestId = userId; 
        const requestDocRef = doc(requestRef, myJoinRequestId);
        
        await setDoc(requestDocRef, {
            userId: userId,
            username: username,
            requestedAt: new Date(),
        });
        
        playerWaitingMessage.classList.remove('hidden');
        generateCardBtn.classList.add('hidden'); 
        
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
        generateCardBtn.classList.remove('hidden');
        myJoinRequestId = null;
    } catch (error) {
        console.error("Error cancelling request: ", error);
    }
}

async function createGame() {
    if (!isHostUser) { 
        showModal('Error', 'You do not have permission to create a game.');
        return;
    }
    
    const newGameId = `BINGO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const fee = parseFloat(feeInput.value);
    
    if (isNaN(fee) || fee <= 0) {
        showModal('Missing Information', 'Please set a valid player fee.');
        return;
    }

    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', newGameId);
    try {
        await setDoc(gameRef, {
            hostId: userId,
            fee: fee,
            calledNumbers: [],
            createdAt: new Date(),
            status: 'waiting'
        });
        gameId = newGameId;
        isHost = true; 
        showGameUI();
        listenForGameUpdates();
        
        showModal('Game Created!', `Game ID: <span class="font-mono font-bold text-blue-300">${gameId}</span>. Player Fee: ${fee}. You are the Host.`, true);
    } catch (error) {
        console.error("Error creating game: ", error);
        showModal('Error', `Failed to create a new game: ${error.message}`);
    }
}

async function joinGame() {
    const username = usernameInput.value.trim();
    const inputId = gameIdInput.value.trim().toUpperCase();
    
    if (!username) {
        showModal('Username Required', 'Please enter a username before joining a game.');
        return;
    }
    if (!inputId) {
        showModal('Invalid ID', 'Please enter a valid Game ID.');
        return;
    }
    
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', inputId);
    try {
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            gameId = inputId;
            
            if (gameDoc.data().hostId === userId) {
                isHost = true;
                showGameUI();
                listenForGameUpdates();
            } else {
                isHost = false;
                showGameUI();
                listenForGameUpdates();
                await requestToJoinGame(); 
            }
            
        } else {
            showModal('Game Not Found', 'The entered Game ID does not exist.');
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
            const newCalledNumbers = data.calledNumbers || [];
            
            if (newCalledNumbers.length > calledNumbers.length) {
                const lastNumber = newCalledNumbers[newCalledNumbers.length - 1];
                drawNumberSound.play().catch(e => console.error("Sound playback failed:", e));
                if (isHost) {
                    speakNumber(lastNumber);
                }
            }
            
            calledNumbers = newCalledNumbers;
            renderCalledNumbers(calledNumbers);
            
            if (data.status === 'in-progress') {
                hostLobbyView.classList.add('hidden');
                hostInGameView.classList.remove('hidden');
                playerLobbyView.classList.add('hidden');
                playerInGameView.classList.remove('hidden');
                gameInfoDiv.classList.remove('hidden');
                leaveGameBtn.classList.remove('hidden'); 
                leaveGameBtnLobby.classList.add('hidden'); 

            } else if (data.status === 'waiting') {
                hostLobbyView.classList.remove('hidden');
                hostInGameView.classList.add('hidden');
                playerLobbyView.classList.remove('hidden');
                playerInGameView.classList.add('hidden');
                gameInfoDiv.classList.add('hidden');
                leaveGameBtn.classList.add('hidden'); 
                leaveGameBtnLobby.classList.remove('hidden'); 

            } else if (data.status === 'finished') {
                showModal('Game Over!', `The winner is ${data.winner}! Thanks for playing.`);
                modalOkBtn.onclick = () => {
                    modalContainer.classList.add('hidden');
                    resetGame();
                    modalOkBtn.onclick = () => modalContainer.classList.add('hidden'); 
                };
            } else if (data.status === 'cancelled') {
                showModal('Game Cancelled', 'The host has cancelled the game.');
                resetGame();
            }
        } else {
            showModal('Game Ended', 'The host has ended the game.');
            resetGame();
        }
    }, (error) => {
        console.error("Error listening to game updates:", error);
        showModal('Error', `Failed to get real-time game updates: ${error.message}`);
    });

    const claimsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'claims');
    unsubscribeClaimsListener = onSnapshot(claimsRef, (querySnapshot) => {
        claimsUl.innerHTML = '';
        const claims = [];
        querySnapshot.forEach((doc) => {
            claims.push({ id: doc.id, ...doc.data() }); 
        });
        
        claims.forEach(claim => {
            const listItem = document.createElement('li');
            const claimButton = document.createElement('button');
            claimButton.classList.add('btn', 'btn-danger', 'w-full', 'text-left', 'px-4', 'py-2', 'rounded-lg');
            claimButton.innerHTML = `<span class="font-bold">${claim.username}</span> claimed BINGO!`;
            
            claimButton.addEventListener('click', () => {
                showClaimModal(claim, claim.id);
            });
            
            listItem.appendChild(claimButton);
            claimsUl.appendChild(listItem);
        });
    }, (error) => {
        console.error("Error listening to claims:", error);
        showModal('Error', `Failed to get real-time claim updates: ${error.message}`);
    });
    
    const playersRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'players');
    unsubscribePlayersListener = onSnapshot(playersRef, (querySnapshot) => {
        playersUl.innerHTML = '';
        playersUlPlayer.innerHTML = '';
        const players = [];
        let playerIsApproved = false; 
        
        querySnapshot.forEach((doc) => {
            const playerData = doc.data();
            players.push(playerData);
            if (playerData.userId === userId) { 
                playerIsApproved = true;
            }
        });

        playerCountSpan.textContent = players.length;
        
        players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.classList.add('text-lg');
            listItem.textContent = player.username;
            playersUl.appendChild(listItem);
            
            const playerLobbyItem = document.createElement('li');
            playerLobbyItem.classList.add('text-lg');
            playerLobbyItem.textContent = player.username;
            playersUlPlayer.appendChild(playerLobbyItem.cloneNode(true));
        });
        
        if (!isHost && playerIsApproved) {
            playerWaitingMessage.classList.add('hidden');
            generateCardBtn.classList.remove('hidden');
            playerLobbyTitle.textContent = 'You are in!';
            myJoinRequestId = null; 
        }
        
        const gameDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
        getDoc(gameDocRef).then(docSnapshot => {
            const fee = docSnapshot.data().fee || 0;
            const prize = (players.length * fee) * 0.8;
            feeDisplay.textContent = `Fee per player: $${fee.toFixed(2)}`;
            prizeAmountDisplay.textContent = `$${prize.toFixed(2)}`;
        });
    }, (error) => {
        console.error("Error listening to players:", error);
        showModal('Error', `Failed to get real-time player list: ${error.message}`);
    });

    if (isHost) {
        const requestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'joinRequests');
        unsubscribeJoinRequestsListener = onSnapshot(requestsRef, (querySnapshot) => {
            joinRequestsList.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const request = doc.data();
                const requestId = doc.id;
                
                const li = document.createElement('li');
                li.className = 'flex items-center justify-between bg-gray-700 p-2 rounded';
                
                const usernameSpan = document.createElement('span');
                usernameSpan.textContent = request.username;
                li.appendChild(usernameSpan);
                
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'space-x-2';
                
                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Approve';
                approveBtn.className = 'btn btn-approve py-1 px-2 text-sm rounded';
                approveBtn.onclick = () => approvePlayer(requestId, request.userId, request.username);
                buttonsDiv.appendChild(approveBtn);
                
                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = 'Reject';
                rejectBtn.className = 'btn btn-danger py-1 px-2 text-sm rounded';
                rejectBtn.onclick = () => rejectPlayer(requestId);
                buttonsDiv.appendChild(rejectBtn);
                
                li.appendChild(buttonsDiv);
                joinRequestsList.appendChild(li);
            });
        }, (error) => {
            console.error("Error listening to join requests:", error);
        });
    }
}

async function startGame() {
    if (!isHost) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId);
    try {
        await setDoc(gameRef, { status: 'in-progress' }, { merge: true });
        showModal('Game Started!', 'The game has officially begun. Start drawing numbers!');
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
            showModal('Game Not Started', 'Please click "Start Game" first!');
            return;
        }
        const currentCalledNumbers = data.calledNumbers || [];
        const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
        const remainingNumbers = allNumbers.filter(num => !currentCalledNumbers.includes(num));
        
        if (remainingNumbers.length > 0) {
            const newNumber = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
            await setDoc(gameRef, {
                calledNumbers: [...currentCalledNumbers, newNumber]
            }, { merge: true });
        } else {
            showModal('Game Over', 'All numbers have been called!');
        }
    } catch (error) {
        console.error("Error drawing number: ", error);
        showModal('Error', `Failed to draw a new number: ${error.message}`);
    }
}

async function claimBingo() {
    const username = usernameInput.value.trim();
    if (!gameCard) {
        showModal('Card Not Generated', 'You must generate a bingo card first.');
        return;
    }
    if (!username) {
        showModal('Username Required', 'Please enter a username before claiming Bingo.');
        return;
    }
    if (checkBingo()) {
        bingoSound.play().catch(e => console.error("Sound playback failed:", e));
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        const claimsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bingoGames', gameId, 'claims');
        try {
            await addDoc(claimsRef, {
                userId: userId,
                username: username,
                claimedAt: new Date(),
                card: JSON.stringify(gameCard) 
            });
            showModal('BINGO!', 'You have successfully claimed Bingo! The host is verifying your card.');
        } catch (error) {
            console.error("Error claiming bingo:", error);
            showModal('Error', `Failed to claim Bingo: ${error.message}`);
        }
    } else {
        showModal('Not a Bingo!', 'Keep playing, you do not have Bingo yet!');
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
            console.error("Error leaving game (deleting player doc): ", error);
        }
    }
    if (myJoinRequestId) {
        await cancelJoinRequest();
    }
    
    resetGame();
    showModal('Game Left', 'You have left the game.');
}

function showClaimModal(claimData, claimId) {
    currentClaimId = claimId;
    currentClaimData = claimData;
    
    claimModalTitle.textContent = `Verify: ${claimData.username}`;
    const card = JSON.parse(claimData.card);
    
    claimModalCard.innerHTML = '';
    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');
            const number = card[i][j];
            cell.textContent = number;
            if (number === 'FREE') {
                cell.classList.add('free');
            }
            if (calledNumbers.includes(number)) {
                cell.classList.add('marked');
            }
            claimModalCard.appendChild(cell);
        }
    }
    
    claimModalCalledNumbers.innerHTML = '';
    calledNumbers.forEach(num => {
        const numberBall = document.createElement('div');
        numberBall.classList.add('number-ball', 'called-number');
        numberBall.style.width = '3rem';
        numberBall.style.height = '3rem';
        numberBall.style.fontSize = '1rem';
        numberBall.textContent = num;
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
    } catch (error) {
        console.error("Error rejecting claim: ", error);
        showModal('Error', `Failed to reject claim: ${error.message}`);
    }
}

function showGameUI() {
    gameSetupArea.classList.add('hidden');
    gameArea.classList.remove('hidden');
    gameStateDiv.classList.remove('hidden');
    currentGameIdDisplay.textContent = `Game ID: ${gameId}`;
    if (isHost) {
        hostViewDiv.classList.remove('hidden');
        playerViewDiv.classList.add('hidden');
        hostLobbyView.classList.remove('hidden');
        hostInGameView.classList.add('hidden');
        gameInfoDiv.classList.add('hidden');
    } else {
        hostViewDiv.classList.add('hidden');
        playerViewDiv.classList.remove('hidden');
        playerLobbyView.classList.remove('hidden');
        playerInGameView.classList.add('hidden');
        gameInfoDiv.classList.add('hidden');
        if (!gameCard) {
            createBingoCard(); 
        }
    }
}

createGameBtn.addEventListener('click', createGame);
joinGameBtn.addEventListener('click', joinGame);
startGameBtn.addEventListener('click', startGame);
drawNumberBtn.addEventListener('click', drawNumber);
endGameBtn.addEventListener('click', endGame);
leaveGameBtn.addEventListener('click', leaveGame);
leaveGameBtnLobby.addEventListener('click', leaveGame);
generateCardBtn.addEventListener('click', createBingoCard);
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
    markedNumbers = new Set();
    gameId = null;
    isHost = false;
    calledNumbers = [];
    renderCalledNumbers([]);
    bingoCardContainer.innerHTML = '';
    gameIdInput.value = '';
    feeInput.value = '';
    myJoinRequestId = null;
    playerWaitingMessage.classList.add('hidden');
    playerLobbyTitle.textContent = 'Waiting for Host...';

    if (!isHostUser) {
        createGameBtn.classList.add('hidden');
        hostSetupDiv.classList.add('hidden');
    }
}

// --- Initialization ---
window.onload = async function() {
    loadingSpinner.classList.remove('hidden');
    try {
        const authResult = await signInAnonymously(auth);
        userId = auth.currentUser.uid;
        authInfo.textContent = `You are authenticated with User ID: ${userId}`;

        try {
            console.log("Checking for host with user ID:", userId);
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

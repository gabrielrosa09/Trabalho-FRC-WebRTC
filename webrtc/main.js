import './style.css'

const firebaseConfig = {
  apiKey: "AIzaSyAPqmjHQYEoKioRLNyvgllgyMKRR9ezhsI",
  authDomain: "projeto-rtc-frc.firebaseapp.com",
  databaseURL: "https://projeto-rtc-frc-default-rtdb.firebaseio.com",
  projectId: "projeto-rtc-frc",
  storageBucket: "projeto-rtc-frc.appspot.com",
  messagingSenderId: "85555353655",
  appId: "1:85555353655:web:b9c7db55d9c599119ac7b2",
  measurementId: "G-QDLRVFM987"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

/**************** parte da hellen vai aqui ******************/

callButton.onclick = async () => {
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

/**************** parte da ana vai aqui ******************/

/**************** Aqui é a parte do chat ******************/

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const nameInput = document.getElementById('nameInput');

const chatCollection = firestore.collection('chats');

sendButton.onclick = async () => {
  const userName = nameInput.value.trim();  // Captura o nome do input
  const message = chatInput.value.trim();   // Captura a mensagem do input

  if (userName && message) {

    await chatCollection.add({
      text: message,
      name: userName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    chatInput.value = '';  
  } else {
    alert('Por favor, digite um nome e uma mensagem antes de enviar.');
  }
};

chatCollection
  .orderBy('timestamp')
  .onSnapshot((snapshot) => {
    chatBox.innerHTML = ''; 
    snapshot.forEach((doc) => {
      const messageData = doc.data();
      const messageElement = document.createElement('p');
      messageElement.innerHTML = `<span class="sender">${messageData.name}:</span> ${messageData.text}`;
      chatBox.appendChild(messageElement); 
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  hangupButton.onclick = async () => {
    // Encerra a conexão
    pc.close();
  
    // Limpa o stream de vídeo local e remoto
    webcamVideo.srcObject = null;
    remoteVideo.srcObject = null;
  
    // Limpa o conteúdo do chat
    chatBox.innerHTML = '';
  
    // Apaga a coleção de chats do Firestore
    const chatCollection = firestore.collection('chats');
    const querySnapshot = await chatCollection.get();
    const batch = firestore.batch();
    
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  
    // Desativa os botões
    callButton.disabled = true;
    answerButton.disabled = true;
    hangupButton.disabled = true;
  };
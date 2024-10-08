import './style.css'

const firebaseConfig = {              
  apiKey: "AIzaSyC1a6Acicl9uW4gr4e_0hd5MkrCSswO_Os",                                    
  authDomain: "webrtc-frc-2024.firebaseapp.com",                                                      
  projectId: "webrtc-frc-2024",                                                                       
  storageBucket: "webrtc-frc-2024.appspot.com",                                                       
  messagingSenderId: "634478244642",          
  appId: "1:634478244642:web:199d7233f214861e2c6b7b"
};      
/*
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
*/
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

const senders = [];

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    senders.push(pc.addTrack(track, localStream));
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

answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

/**************** Aqui é a parte do chat ******************/

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const nameInput = document.getElementById('nameInput');
const raiseHandButton = document.getElementById('raiseHandButton');

raiseHandButton.onclick = async () => {
  const userName = nameInput.value.trim();

  if (userName) {
    await chatCollection.add({
      text: `${userName} levantou a mão ✋`,
      name: 'Sistema',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert(`${userName}, você levantou a mão!`);
  } else {
    alert('Por favor, insira seu nome antes de levantar a mão.');
  }
};


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


screenshareButton.onclick = async () => {
    localStream = navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
        const screenTrack = stream.getTracks()[0];
        senders.find(sender => sender.track.kind === 'video').replaceTrack(screenTrack);
        screenTrack.onended = function() {
            senders.find(sender => sender.track.kind === 'video').replaceTrack(localStream.getTracks()[1]);
        }
    })
}

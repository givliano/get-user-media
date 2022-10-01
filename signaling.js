// Summarizes the complete signaling process. The code assumes the existence of some signaling mechanism, SignalingChannel.
// Link: https://web.dev/webrtc-infrastructure/
// https://web.dev/webrtc-basics/
// Handles JSON.stringify/parse
const signaling = new SignalingChannel();
const constraints = {
  audio: true,
  video: true
};
const configuration = {
  iceServers: [{
    urls: 'stun:stun.example.org'
  }]
};
const pc = new RTCPeerConnection(configuration);

// Send ICE candidates to the other peer.
// `Finding candidates` refers to the process of finding network interfaces and ports using the ICE framework.
// This `onicecandidate` handler will run when network candidates become available.
// `Local` sends serialized data to the `remote` peer, using whatever signaling channel they want, such as WebSocket.
// The `remote` peer gets a candidate message from the `local`, and calls `addIceCandidate` to add the local to it's remote peer description.
pc.onicecandidate = ({ candidate }) => signaling.send({ candidate });

// Let the 'negotiationneeded' event trigger offer generation.
pc.onnegotiationneeded = async () => {
  try {
    // Creates the `local` description to be offered to the `remote` peer.
    await pc.setLocalDescription(await pc.createOffer());
    // Send the offer to the other peer.
    signaling.send({ desc: pc.localDescription });
  } catch(error) {
    console.log('Error offering local description: ', error);
  }
};

// After remote track media arrives, show it in remote video element.
pc.ontrack = (event) => {
  // Don't set srcObject again if it is already set.
  if (remoteView.srcObject) return;
  remoteView.srcObject = event.streams[0];
};

// Call `start()` to initiate.
async function start() {
  try {
    // Get local stream, show it in self-view, and add it to be sent.
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    })
    selfView.srcObject = stream;
  } catch (error) {
    console.log('Error setting local streams: ', error);
  }
}

signaling.onmessage = async ({ description, candidate }) => {
  try {
    if (description) {
      // If you get an offer, you need to reply with an answer.
      if (description.type === 'offer') {
        // `Remote` sets the description offered by `local`.
        const stream = await pc.setRemoteDescription(description);
        stream.getTracks().forEach(async (track) => {
          pc.addTrack(track, stream);
          await pc.setLocalDescription(await pc.createAnswer());
          signaling.send({ description: pc.localDescription });
        });
      } else if (description.type === 'answer') {
        // `Local` sets the remote description with the answer sent by `remote`.
        await pc.setRemoteDescription(description);
      } else {
        console.log('Unsupporter SDP type.');
      }
    } else if (candidate) {
      await pc.addIceCandidate(candidate);
    }
  } catch (error) {
    console.log(error);
  }
}

// Servers used for the signaling between the peers. so that they
// can be discovered by their public IP's and port.
// In case the STUN servers fails, a TURN is used as backup.
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' }
  ]
});

// We must transfer data by chunks, as the browswer has a maximum buffer size
// as default of 256 kB. We will split the file into smaller chunks of
// 64 kB, with a flag for the last chunk and with the `arrayBuffer byteLength` also.
// the chunks MUST arrive in the right order to get the file correctly.
class Channel {
  static BYNARY_TYPE_CHANNEL = 'arraybuffer';
  static MAXIMUM_SIZE_DATA_TO_SEND = 65535;
  static BUFFER_THRESHOLD = 65535;
  static LAST_DATA_OF_FILE = 'LDOF7';

  transferFile(fileToShare) {
    this.#channel.onopen = async () => {
      const arrayBuffer = await fileToShare.arrayBuffer();

      try {
        this.send(
          JSON.stringify({
            totalByte: arrayBuffer.byteLength,
            dataSize = Channel.MAXIMUM_SIZE_DATA_TO_SEND
          })
        );

        for (let i = 0; i < arrayBuffer.byteLength; i += Channel.MAXIMUM_SIZE_DATA_TO_SEND) {
          this.send(arrayBuffer.slice(i, i + Channel.MAXIMUM_SIZE_DATA_TO_SEND));
        }
      } catch (error) {
        console.error('Error sending big file: ', error);
      }
    }

    return true;
  }

  // Avoid overflowing the outgoing channel buffer by adding the chunks
  // to a queue which will be pop when below the threshold.
  // To know if it's below the threshold, use the `bufferedamountlow` event.
  send(data) {
    this.#queue.push(data);

    if (this.#paused) {
      return;
    }

    this.shiftQueue();
  }

  shiftQueue() {
    this.#paused = false;
    let message = this.#queue.shift();

    while (message) {
      if (this.#channel.bufferedAmount && this.#channel.bufferedAmount > Channel.BUFFER_THRESHOLD) {
        this.#paused = true;
        this.#queue.unshift(message);

        const listener = () => {
          this.#channel.removeEventListener('bufferedamountlow', this.shiftQueue());
        }

        this.#channel.addEventListener('bufferedamountlow', listener);
        return;
      }

      try {
        this.#channel.send(message);
        message = this.#queue.shift();
      } catch (error) {
        throw new Error(`Error to send the next data: ${error.name} ${error.message}`);
      }
    }
  }


}

const channelLabel = 'Test Channel';
this.#peerConnection = new RTCPeerConnection(config);

this.#channel = this.#peerConnection.createDataChannel(channelLabel);
this.#channel.binaryType = Channel.BYNARY_TYPE_CHANNEL;

// On the other site, we must implement the `ondatachannel` event handler
// to process the data sent.
// Each peerConnection will create a channel with `createDataChannel`,
// and the binaryType property as `arraybuffer`.
 // Like for the `send` and `shiftQueue` methods for sending queued chunks,
// we must also implement ways to queue the received chunks and determine
// when we have them all completed, via the `Channel.LAST_DATA_OF_FILE`
const onDataChannelCallback = (event) => {
  const { channel } = event;

  let receivedBuffer = [];
  let totalBytesFileBuffer = 0;
  let totalBytesArrayBuffers = 0;

  channel.onmessage = (event) => {
    const { data } = event;

    try {
      if (data.byteLength) {
        receivedBuffer.push(data);
        totalBytesArrayBuffers += data.byteLength;

        if (totalBytesFileBuffer > 0) {
          this.setState({
            progressTransferFile: (totalBytesArrayBuffers * 100) / totalBytesArrayBuffers;
          });
        }
      } else if (data === Channel.LAST_DATA_FILE) {
        getCompleteFile(receivedBuffer, totalBytesArrayBuffers, channel.label);
        channel.close();

        receivedBuffer = [];
        totalBytesArrayBuffers = 0;
        totalBytesArrayBuffers = 0;
      } else {
        const initMessage = JSON.parse(data);
        totalBytesFileBuffer = initMessage.totalByte || 0;
      }
    } catch (error) {
      receivedBuffer = [];
      totalBytesFileBuffer = 0;
      totalBytesArrayBuffers = 0;
    }
  };
};

// Put all the chunks in a new arrayBuffer and put it in a new Blob
// after it downloads
export const getCompleteFile = (receivedArrayBuffers, totalBytesArrayBuffers, fileName) => {
  let offset = 0;
  const uIntArrayBuffer = new Uint8Array(totalBytesArrayBuffers, 0);

  receivedArrayBuffers.forEach((arrayBuffer) => {
    uIntArrayBuffer.set(new Uint8Array(arrayBuffer.buffer || arrayBuffer, arrayBuffer.byteOffset), offset);
    offset += arrayBuffer.byteLength;
  });

  const blobObject = new Blob([uIntArrayBuffer]);

  return downloadFile(blobObject, fileName);
}

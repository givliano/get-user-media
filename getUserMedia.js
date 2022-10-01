// An object specifying the types of media to request, along with any requirements for each type.
// If true is specified for a media type, the resulting stream is required to have that type of track in it. If one cannot be included for any reason, the call to getUserMedia() will result in an error.
const constraints = {
  video: {
    width: { min: 1024, ideal: 1920, max: 1920 },
    height: { min: 576, ideal: 1080, max: 1080 }
  }
};

const getMedia = async (constraints) => {
  const video = document.getElementById('video');
  let stream = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();
  } catch (error) {
    console.log(`Error getting user media: ${error.name} - {error.message}}`);
  }
  console.log(stream);
}

getMedia(constraints);

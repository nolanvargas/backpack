self.onmessage = (e) => {
  const frame = e.data
  // placeholder for OpenCV.js processing
  self.postMessage([])
}

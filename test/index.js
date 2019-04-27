import {
  buf2hex,
  toBitsFromUint8Array,
  extractChildren
} from '../src/utils.js'
import MediaTrack from '../src/MediaTrack.js'

let ftypSize = 0

const url = 'http://127.0.0.1:8080/test/video/movie_300.mp4'
var oReq = new XMLHttpRequest();
oReq.onload = function (e) {
  var arraybuffer = oReq.response;
  ftypSize = Number('0x' + buf2hex(arraybuffer));

  console.log(ftypSize)

  requestMoovSize(ftypSize)
}
oReq.open("GET", url);
oReq.setRequestHeader('Range', 'bytes=0-3')
oReq.responseType = "arraybuffer";
oReq.send();

function extractSample(moovBuffer, moovOffset) {
  moovBuffer.fileStart = 0

  const mp4boxfile = new MP4Box(false);
  mp4boxfile.onError = function (e) {
    console.error(e);
  };
  mp4boxfile.onMoovStart = function () {
    console.log("Starting to receive File Information");
  };
  mp4boxfile.onReady = function (info) {
    console.log(info);

    const offset = mp4boxfile.seek(10, false);
    console.log('10s 的偏移量是：', offset);
    mp4boxfile.onSamples = function (id, user, samples) {
      console.log(id, user, samples)
    }
    mp4boxfile.setExtractionOptions(info.tracks[0].id, {});
    mp4boxfile.start();

    requestSamples(offset.offset, offset.offset + 1000000, (ab) => {
      ab.fileStart = offset.offset
      mp4boxfile.appendBuffer(ab)
      debugger
      mp4boxfile.stop();
      mp4boxfile.flush();
    })
  };
  mp4boxfile.appendBuffer(moovBuffer);
}

function requestMoovSize(ftypSize) {
  let moovSize = 0
  var oReq = new XMLHttpRequest();
  oReq.onload = function (e) {
    var arraybuffer = oReq.response;
    moovSize = Number('0x' + buf2hex(arraybuffer));

    console.log(moovSize)

    requsetMoov(moovSize)
  }
  oReq.open("GET", url);
  oReq.setRequestHeader('Range', `bytes=${ftypSize}-${ftypSize + 3}`)
  oReq.responseType = "arraybuffer";
  oReq.send();
}

function requsetMoov(moovSize) {
  var oReq = new XMLHttpRequest();
  oReq.onload = function (e) {
    var arraybuffer = oReq.response;
    // const moov = buf2hex(arraybuffer);
    console.log(arraybuffer)
    // console.log(moov)

    const moov = parseMoov(arraybuffer);
    const tracks = moov.children
      .filter(child => child.type === 'trak')
      .map(trakBox => new MediaTrack(trakBox));
    console.log('tracks:', tracks)
    const movieTrack = tracks[0]
    const {entrySize: size, offset} = movieTrack.getSampleSizeAndOffset(300)
    console.log('10s 时的 sample 大小和偏移量为：', size, offset)
    requestSampleData(offset, size)

    // extractSample(arraybuffer, ftypSize)
  }
  oReq.open("GET", url);
  oReq.setRequestHeader('Range', `bytes=${ftypSize}-${ftypSize + moovSize - 1}`)
  oReq.responseType = "arraybuffer";
  oReq.send();
}

function requestSamples(start, end, cb) {
  var oReq = new XMLHttpRequest();
  oReq.onload = function (e) {
    var arraybuffer = oReq.response;
    // const moov = buf2hex(arraybuffer);
    console.log(arraybuffer)
    // console.log(moov)

    cb(arraybuffer)
  }
  oReq.open("GET", url);
  oReq.setRequestHeader('Range', `bytes=${start}-${end}`)
  oReq.responseType = "arraybuffer";
  oReq.send();
}

function parseMoov(moovBuffer) {
  const moovInt8 = new Uint8Array(moovBuffer)
  console.log(moovInt8)
  const moovSize = Array.from(moovInt8.slice(0, 4)).map(n => ('00' + n.toString(16)).slice(-2)).join('')
  console.log('moov size:', Number('0x' + moovSize))

  const moov = {
    type: 'moov',
    size: moovSize,
    data: moovInt8,
  }

  moov.children = extractChildren(moov)
  console.table(moov)
  return moov
}

function requestSampleData(offset, size) {
  var oReq = new XMLHttpRequest();
  oReq.onload = function (e) {
    var arraybuffer = oReq.response;
    console.log(arraybuffer)
    console.log(Array.from(new Uint8Array(arraybuffer)).map(n => ('00000000' + n.toString(2)).slice(-8)).join(''))
  }
  oReq.open("GET", url);
  oReq.setRequestHeader('Range', `bytes=${offset}-${offset + size - 1}`)
  oReq.responseType = "arraybuffer";
  oReq.send();
}
function decode(heatmap, scale, offset, landmark, size, threshold = 0.1) {
  // Squeeze heatmap
  heatmap = heatmap[0][0];

  const scale0 = scale[0][0];
  const scale1 = scale[0][1];
  const offset0 = offset[0][0];
  const offset1 = offset[0][1];

  const [height, width] = size;

  let boxes = [];
  let lms = [];

  for (let i = 0; i < heatmap.length; i++) {
    for (let j = 0; j < heatmap[i].length; j++) {
      if (heatmap[i][j] > threshold) {
        const s0 = Math.exp(scale0[i][j]) * 4;
        const s1 = Math.exp(scale1[i][j]) * 4;
        const o0 = offset0[i][j];
        const o1 = offset1[i][j];
        const s = heatmap[i][j];

        let x1 = Math.max(0, (j + o1 + 0.5) * 4 - s1 / 2);
        let y1 = Math.max(0, (i + o0 + 0.5) * 4 - s0 / 2);
        x1 = Math.min(x1, width);
        y1 = Math.min(y1, height);

        boxes.push([
          x1,
          y1,
          Math.min(x1 + s1, width),
          Math.min(y1 + s0, height),
          s,
        ]);
        let lm = [];
        for (let k = 0; k < 5; k++) {
          lm.push(landmark[0][k * 2 + 1][i][j] * s1 + x1);
          lm.push(landmark[0][k * 2][i][j] * s0 + y1);
        }
        lms.push(lm);
      }
    }
  }

  if (boxes.length > 0) {
    const keep = nms(
      boxes.map((box) => box.slice(0, 4)),
      boxes.map((box) => box[4]),
      0.3
    );
    boxes = keep.map((i) => boxes[i]);
    lms = keep.map((i) => lms[i]);
  }

  return [boxes, lms];
}

function nms(boxes, scores, nmsThresh) {
  const x1 = boxes.map((box) => box[0]);
  const y1 = boxes.map((box) => box[1]);
  const x2 = boxes.map((box) => box[2]);
  const y2 = boxes.map((box) => box[3]);
  const areas = x2.map((x, i) => (x - x1[i]) * (y2[i] - y1[i]));

  const order = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.index);

  const numDetections = boxes.length;
  const suppressed = new Array(numDetections).fill(false);
  const keep = [];

  for (let _i = 0; _i < numDetections; _i++) {
    const i = order[_i];
    if (suppressed[i]) continue;

    keep.push(i);

    const ix1 = x1[i];
    const iy1 = y1[i];
    const ix2 = x2[i];
    const iy2 = y2[i];
    const iarea = areas[i];

    for (let _j = _i + 1; _j < numDetections; _j++) {
      const j = order[_j];
      if (suppressed[j]) continue;

      const xx1 = Math.max(ix1, x1[j]);
      const yy1 = Math.max(iy1, y1[j]);
      const xx2 = Math.min(ix2, x2[j]);
      const yy2 = Math.min(iy2, y2[j]);

      const w = Math.max(0, xx2 - xx1);
      const h = Math.max(0, yy2 - yy1);

      const inter = w * h;
      const ovr = inter / (iarea + areas[j] - inter);

      if (ovr >= nmsThresh) {
        suppressed[j] = true;
      }
    }
  }

  return keep;
}
function postprocessDetections(
  dets,
  lms,
  h_new,
  w_new,
  scale_w,
  scale_h,
  threshold
) {
  // Assume decode function is already implemented
  let [decodedDets, decodedLms] = decode(
    heatmap,
    scale,
    offset,
    lms,
    [h_new, w_new],
    threshold
  );

  if (decodedDets.length > 0) {
    // Process detections
    for (let i = 0; i < decodedDets.length; i++) {
      // Update x coordinates
      decodedDets[i][0] /= scale_w;
      decodedDets[i][2] /= scale_w;
      // Update y coordinates
      decodedDets[i][1] /= scale_h;
      decodedDets[i][3] /= scale_h;
    }

    // Process landmarks
    for (let i = 0; i < decodedLms.length; i++) {
      for (let j = 0; j < 5; j++) {
        // Update x coordinates
        decodedLms[i][j * 2] /= scale_w;
        // Update y coordinates
        decodedLms[i][j * 2 + 1] /= scale_h;
      }
    }
  } else {
    // If no detections, return empty arrays
    decodedDets = [];
    decodedLms = [];
  }

  return [decodedDets, decodedLms];
}

function shapeTransform(inShape, origShape) {
  const [hOrig, wOrig] = origShape;
  let [wNew, hNew] = inShape;

  // Make spatial dims divisible by 32
  wNew = Math.ceil(wNew / 32) * 32;
  hNew = Math.ceil(hNew / 32) * 32;

  const scaleW = wNew / wOrig;
  const scaleH = hNew / hOrig;

  return [wNew, hNew, scaleW, scaleH];
}

const preProcessImg = (img) => {};

export { decode };

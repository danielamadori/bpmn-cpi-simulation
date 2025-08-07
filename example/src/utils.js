export function svgToPng(svg) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([ svg ], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    image.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(blob) {
        resolve(blob);
      }, 'image/png');
    };

    image.onerror = reject;
    image.src = url;
  });
}

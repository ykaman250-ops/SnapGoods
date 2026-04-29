import fs from 'fs';
import https from 'https';
import path from 'path';

fs.mkdirSync('public', {recursive: true});

const download = (url: string, dest: string) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function run() {
  await download('https://placehold.co/192x192/1E3a8a/FFFFFF.png?text=NV', path.join('public', 'icon-192.png'));
  await download('https://placehold.co/512x512/1E3a8a/FFFFFF.png?text=NV', path.join('public', 'icon-512.png'));
  console.log('Icons downloaded.');
}

run();

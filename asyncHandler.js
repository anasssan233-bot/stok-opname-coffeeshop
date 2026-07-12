// Express 4 tidak menangkap error dari async function secara otomatis --
// kalau sebuah `await` di dalam route handler reject dan tidak ada try/catch,
// itu jadi "unhandled rejection" yang bisa mematikan seluruh proses di lingkungan
// serverless seperti Vercel. Wrapper ini membungkus setiap handler supaya error-nya
// selalu diteruskan ke Express lewat next(err), lalu ditangani rapi oleh
// error-handling middleware di server.js -- bukan menjatuhkan seluruh function.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

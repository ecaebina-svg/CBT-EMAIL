// src/utils/mailer.js
// Utility untuk mengirim email menggunakan Nodemailer
// Support: Mailtrap (testing) dan Gmail SMTP (production)

const nodemailer = require('nodemailer');
require('dotenv').config();

// Buat transporter berdasarkan konfigurasi .env
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false, // true untuk port 465, false untuk port lain
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

// Kirim email verifikasi dengan kode 6 digit
async function sendVerificationEmail(toEmail, toName, verificationCode) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || 'CBT App'}" <${process.env.MAIL_FROM_ADDRESS || 'noreply@cbtapp.com'}>`,
    to: toEmail,
    subject: '✅ Verifikasi Email Akun CBT Anda',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .logo { text-align: center; margin-bottom: 24px; }
          .logo span { font-size: 24px; font-weight: 700; color: #2563eb; }
          h2 { color: #1e293b; margin-bottom: 8px; }
          p { color: #64748b; line-height: 1.6; }
          .code-box { background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0; }
          .code { font-size: 40px; font-weight: 700; letter-spacing: 10px; color: #2563eb; }
          .code-label { font-size: 13px; color: #64748b; margin-top: 8px; }
          .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; }
          .warning { background: #fef9c3; border-radius: 8px; padding: 12px; font-size: 13px; color: #854d0e; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo"><span>🎓 CBT App</span></div>
          <h2>Halo, ${toName}!</h2>
          <p>Terima kasih telah mendaftar di <strong>CBT App</strong>. Gunakan kode verifikasi berikut untuk mengaktifkan akun Anda:</p>
          
          <div class="code-box">
            <div class="code">${verificationCode}</div>
            <div class="code-label">Kode Verifikasi 6 Digit</div>
          </div>
          
          <p>Masukkan kode ini di halaman verifikasi untuk mengaktifkan akun Anda.</p>
          
          <div class="warning">
            ⚠️ Kode ini berlaku selama <strong>24 jam</strong>. Jangan bagikan kode ini kepada siapa pun.
          </div>
          
          <div class="footer">
            <p>Email ini dikirim otomatis oleh sistem CBT App.</p>
            <p>Jika Anda tidak mendaftar, abaikan email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Halo ${toName}, kode verifikasi email Anda adalah: ${verificationCode}. Kode berlaku 24 jam.`,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email verifikasi terkirim ke ${toEmail} | MessageID: ${info.messageId}`);
  return info;
}

module.exports = { sendVerificationEmail };

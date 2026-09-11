import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_PORT === "465",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendOtpEmail(
  email: string,
  otp: string,
  name = "there",
  purpose: "register" | "login" = "register"
) {
  const isRegister = purpose === "register";

  const subject = isRegister
    ? "Verify your email | Voxbridge"
    : "Your sign-in code | Voxbridge";

  const heading = isRegister ? "You're almost there." : "Welcome back.";

  const message = isRegister
    ? "Use the verification code below to finish setting up your Voxbridge account."
    : "Use the verification code below to securely sign in to your Voxbridge account.";

  const text = `Voxbridge

${heading}

Hi ${name},

${message}

Verification code: ${otp}

This code is valid for 5 minutes.

Didn't request this?
You can safely ignore this email.

Voxbridge
Connect. Communicate. Understand.`;

  const html = `
    <div style="margin:0;padding:40px 20px;background:#f7f8fa;font-family:Arial,Helvetica,sans-serif;color:#202124;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">
        <div style="padding:28px 32px;">
          <div style="font-size:21px;font-weight:700;">
            Voxbridge
          </div>

          <div style="margin-top:40px;">
            <h1 style="margin:0 0 20px;font-size:24px;font-weight:600;">
              ${heading}
            </h1>

            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
              Hi ${name},
            </p>

            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">
              ${message}
            </p>

            <div style="padding:18px;text-align:center;background:#f5f6f8;border-radius:8px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">
                Verification code
              </div>

              <div style="margin-top:8px;font-size:30px;font-weight:600;letter-spacing:6px;color:#111827;">
                ${otp}
              </div>
            </div>

            <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">
              This code is valid for 5 minutes.
            </p>

            <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
              Didn't request this?<br>
              You can safely ignore this email.
            </p>
          </div>
        </div>

        <div style="padding:20px 32px;border-top:1px solid #e5e7eb;">
          <div style="font-size:13px;font-weight:600;">
            Voxbridge
          </div>

          <div style="margin-top:4px;font-size:12px;color:#9ca3af;">
            Connect. Communicate. Understand.
          </div>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject,
    text,
    html,
  });
}
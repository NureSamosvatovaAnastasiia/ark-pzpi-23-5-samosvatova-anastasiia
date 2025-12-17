const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, code) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,  
            port: process.env.SMTP_PORT || 587, 
            secure: false,
            auth: {
                user: process.env.SMTP_USER, 
                pass: process.env.SMTP_PASS  
            }
        });

        const mailOptions = {
            from: `"AgroSense" <${process.env.SMTP_USER}>`, 
            to: email,                                      
            subject: 'Verification Code',                 
            text: `Your verification code: ${code}`,     
            html: `<p>Your verification code: <b>${code}</b></p>` 
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);

        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = { sendVerificationEmail };

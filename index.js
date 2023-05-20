import * as dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import { createTransport } from "nodemailer";
import audit from "express-requests-logger";
import bunyan from "bunyan";
const logger = bunyan.createLogger({name: 'SMTP'});

const app = express();

const corsOptions = {
    origin: ["localhost", "code-server"],
    methods: ["GET", "POST"], // Specify the allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify the allowed headers
    credentials: true, // Enable CORS credentials
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    audit({
        logger: logger,
        request: {
            excludeHeaders: ["authorization"],
        },
        shouldSkipAuditFunc: function (req, res) {
            return res.statusCode === 200;
        },
    })
);

const contactEmail = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
    tls: {
        ciphers: "SSLv3",
    },
};

const transporter = createTransport(contactEmail);

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready to send mail!");
    }
});

app.post("/email", async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];

    if (!verifyToken(token)) {
        return res.status(401).json({ error: "No authorization" });
    }

    let form = req.body;
    await transporter
        .sendMail({
            from: process.env.SMTP_FROM,
            to: form.to,
            subject: form.subject,
            text: form.text,
            html: form.html,
        })
        .then((info) =>
            res
                .status(200)
                .send({ message: "Mail sent", message_id: info.messageId })
        )
        .catch((err) => {
            res.status(500).send({ message: err });
        });
});

function verifyToken(token) {
    if (token === process.env.TOKEN) return true;
    return false;
}

const port = 5000;
app.listen(port, () =>
    console.log(`Express server listening on port ${port}...`)
);

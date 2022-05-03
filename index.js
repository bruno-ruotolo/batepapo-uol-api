import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import { stripHtml } from "string-strip-html"
import chalk from "chalk";
dotenv.config();

// express configs
const app = express();
app.use(express.json());
app.use(cors());

//mongodb configs
let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => {
  db = mongoClient.db("projeto_12_UOL");
  console.log(chalk.magenta.bold("DB ON"));
});
promise.catch((e) => {
  console.log(chalk.red.bold("DB OFF", e))
})

//participants route
app.get("/participants", async (req, res) => {
  try {
    const participantsList = await db.collection("participants").find({}).toArray();
    res.status(200).send(participantsList);
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
  }
})

app.post("/participants", async (req, res) => {
  try {
    const participantName = req.body;

    const participantsSchema = joi.object({
      name: joi.string().required(),
    })

    const participantsValidation = participantsSchema.validate(participantName, { abortEarly: false });

    if (participantsValidation.error) {
      res.status(422).send(participantsValidation.error.message);
      return;
    }

    let { name } = participantName
    name = stripHtml(name).result.trim();
    const participantsExist = await db.collection("participants").findOne({ name: name })

    if (participantsExist) {
      res.sendStatus(409);
      return;
    }

    await db.collection("participants").insertOne({
      name: name,
      lastStatus: Date.now()
    });
    await db.collection("messages").insertOne({
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format("HH:mm:ss")
    });
    res.status(201).send({ name: name });
  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
  }
});

//messages route
app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;

  try {
    if (limit) {
      const messagesList = await db
        .collection("messages")
        .find({ $or: [{ to: user }, { to: "Todos" }, { type: "message" }, { from: user }] })
        .toArray();

      const messagesListSplice = [...messagesList].reverse().splice(0, parseInt(limit)).reverse()
      res.status(200).send(messagesListSplice);
      return;
    }

    const messagesList = await db
      .collection("messages")
      .find({ $or: [{ to: user }, { to: "Todos" }, { type: "message" }, { from: user }] })
      .toArray();

    res.status(200).send(messagesList);

  } catch (e) {
    res.status(500).send(e);
    console.log(chalk.red.bold(e));
  }
});

app.post("/messages", async (req, res) => {
  const { user } = req.headers;
  const { body } = req
  const reqBody =
  {
    to: stripHtml(body.to).result.trim(),
    from: stripHtml(user).result.trim(),
    text: stripHtml(body.text).result.trim(),
    type: stripHtml(body.type).result.trim(),
    time: dayjs().format("HH:mm:ss")
  }

  let participantsExist = await db.collection("participants").findOne({ name: user });
  participantsExist = participantsExist ? { name: user } : { name: "a valid user" }

  const messagesSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('private_message', 'message'),
    from: joi.string().required().valid(participantsExist.name),
    time: joi.required()
  });

  const messagesValidate = messagesSchema.validate(reqBody, { abortEarly: false });

  if (messagesValidate.error) {
    res.status(422).send(messagesValidate.error.details.map((error) => { return error.message }))
    return;
  }

  try {

    await db.collection("messages").insertOne(reqBody);
    res.sendStatus(201);

  } catch (e) {
    console.log(chalk.red.bold(e));
    res.status(500).send(e);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;

  try {
    const searchMessageId = await db.collection("messages").find({ _id: new ObjectId(id) }).toArray();
    if (searchMessageId.length === 0) {
      res.sendStatus(404);
      return;
    }

    const searchUser = await db.collection("messages").find({ _id: new ObjectId(id), from: user }).toArray();

    if (searchUser.length === 0) {
      res.sendStatus(401);
      return;
    }

    await db.collection("messages").deleteOne({ _id: new ObjectId(id) });
    res.sendStatus(201);

  } catch (e) {
    res.sendStatus(500);
  }
});

app.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;
  const { to, text, type } = req.body;

  try {
    let participant = await db.collection("participants").findOne({ name: user });
    participant = participant ? participant : { name: null }

    const reqBody = {
      to,
      text,
      type,
      from: participant.name
    }

    const editSchema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required(),
      from: joi.string().required()
    });

    const validateEdit = editSchema.validate(reqBody);
    if (validateEdit.error) {
      res.sendStatus(422);
      return;
    }

    const searchMessageId = await db.collection("messages").find({ _id: new ObjectId(id) }).toArray();
    if (searchMessageId.length === 0) {
      res.sendStatus(404);
      return;
    }

    const searchUser = await db.collection("messages").find({ _id: new ObjectId(id), from: user }).toArray();
    if (searchUser.length === 0) {
      res.sendStatus(401);
      return;
    }

    await db.collection("messages").updateOne({ _id: new ObjectId(id) }, { $set: reqBody });
    res.sendStatus(201);

  } catch (e) {
    res.sendStatus(500);
    console.log(chalk.red.bold(e));
  }
});

//status route
app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    const participantsCollection = db.collection("participants");
    const participantsList = await participantsCollection.findOne({ name: user });

    if (!participantsList) {
      res.sendStatus(404);
      return;
    }

    await participantsCollection.updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);

  } catch (e) {
    console.log(chalk.red.bold(e));
    res.status(500).send(e);
  }
});

//remove participants
setInterval(async () => {
  try {
    const participantsCollection = db.collection("participants");
    const participantsList = await participantsCollection
      .find({})
      .toArray();

    for (let i = 0; i < participantsList.length; i++) {
      if (participantsList[i].lastStatus < (Date.now() - 10000)) {

        const reqBody =
        {
          to: "Todos",
          from: participantsList[i].name,
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss")
        }
        await db.collection("messages").insertOne(reqBody);

        await participantsCollection.deleteOne({ _id: new ObjectId(participantsList[i]._id) });
      }
    }

  } catch (e) {
    console.log(chalk.red.bold(e));
  }
}, 15000);

app.listen(process.env.PORT, () => console.log(chalk.blue.bold("Server ON")));
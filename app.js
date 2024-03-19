const express = require('express');
const session = require('express-session');
const { Datastore } = require('@google-cloud/datastore');
const {DatastoreStore} = require('@google-cloud/connect-datastore');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;
dotenv.config();

// Replace these values with your GitHub app's client ID and secret
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Initialize Google Cloud Datastore
const datastore = new Datastore();

// Express session middleware
app.use(session({
  store: new DatastoreStore({
    kind: 'express-sessions',

    // Optional: expire the session after this many milliseconds.
    // note: datastore does not automatically delete all expired sessions
    // you may want to run separate cleanup requests to remove expired sessions
    // 0 means do not expire
    expirationMs: 0,

    dataset: new Datastore({

      // For convenience, @google-cloud/datastore automatically looks for the
      // GCLOUD_PROJECT environment variable. Or you can explicitly pass in a
      // project ID here:
      projectId: process.env.GCLOUD_PROJECT,

      // For convenience, @google-cloud/datastore automatically looks for the
      // GOOGLE_APPLICATION_CREDENTIALS environment variable. Or you can
      // explicitly pass in that path to your key file here:
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    })
  }),
  secret: process.env.SESSION_SECRET || 'jingle-fm',
  resave: false,
  saveUninitialized: true
}));

// Passport middleware
app.use(express.static(path.join(__dirname, 'build')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + 'build/index.html');
});

class HttpError extends Error {
  status;
  constructor(message, status) {
      super(message);
      this.status = status;
  }
}

const addUserToSession = (req, res, user) => {
  const session = req.session;
  session.userid = user.id;
};
const addUserToDatastore = async (user) => {
  const kind = "User";
  const key = datastore.key([kind, user.id]);
  const entity = {
      key: key,
      data: [
          {
              name: "name",
              value: user.name,
          },
          {
              name: "login",
              value: user.login,
          },
          {
              name: "id",
              value: user.id,
          },
          {
              name: "avatar_url",
              value: user.avatar_url,
          },
          {
              name: "created_on",
              value: new Date().toISOString(),
          },
          {
              name: "access_token",
              value: user.access_token
          }
      ],
  };
  const [existing_user] = await datastore.get(key);
  if (!existing_user) {
      await datastore.save(entity);
  }
};
const authenticatedUser = async (req, res, next) => {
  const session = req.session;
  if (session.userid !== undefined) {
      const userid = session.userid;
      const result = await datastore.get(datastore.key(["User", userid]));
      if (result[0]) {
          req.user = result[0];
          return next();
      }
  }
  const error = new HttpError("Unauthorized", 401);
  return next(error);
};

app.get("/auth/user", authenticatedUser, async (req, res) => {
  const session = req.session;
  //   if (req.cookies.userid) {
  if (session.userid !== undefined) {
      const userid = session.userid;
      // const userid: string = req.cookies.userid;
      const key = datastore.key(["User", userid]);
      const result = await datastore.get(key);
      // datastore.get(key).then((result: any) => {
      if (result[0]) {
          res.send(result[0]);
      }
      else {
          res.status(401).send({ message: "User not found in DB" });
      }
      // });
  }
  else {
      res.status(401).send({ message: "User not found in session" });
  }
});
app.get("/auth/github/callback", async (req, res, next) => {
  // The req.query object has the query params that were sent to this route.
  const requestToken = req.query.code;
  let result = await axios({
      method: "post",
      url: `https://github.com/login/oauth/access_token?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}&code=${requestToken}`,
      // Set the content type header, so that we get the response in JSON
      headers: {
          accept: "application/json",
      },
  });
  let accessToken = result.data.access_token;
  let userData = await axios({
      method: "get",
      url: `https://api.github.com/user`,
      headers: {
          Authorization: "bearer " + accessToken,
      },
  });
  console.log("user data:-", userData.data);
  const userDetail = {
      name: userData.data.name,
      login: userData.data.login,
      id: userData.data.id,
      avatar_url: userData.data.avatar_url,
      created_on: new Date().toISOString(),
      access_token: accessToken
  };
  console.log("user details:-", userDetail);
  // addUserToCookie(res, userDetail);
  // addUserToDatastore(userDetail);
  try {
      addUserToSession(req, res, userDetail);
      await addUserToDatastore(userDetail);
      res.redirect("/");
  }
  catch (error) {
      next(error); // Forward error to error handler middleware
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

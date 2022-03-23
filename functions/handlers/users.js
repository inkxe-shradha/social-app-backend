let token, userId;
const { db, admin } = require("../util/admin");
const config = require("../util/config");
const firebase = require("firebase");
const {
  validateSignupData,
  validateLoginData,
  reduceUserDetails,
} = require("../util/validators");
const { json } = require("express");
firebase.initializeApp(config);
exports.signUp = (req, resp) => {
  // Creating a new User
  const noImage = "no-image.png";
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };
  const { valid, errors } = validateSignupData(newUser);
  if (!valid) {
    return resp.status(400).json(errors);
  }
  // Checking for the duplicate handle not to repeat
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return resp
          .status(400)
          .json({ handle: "This handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })

    // Geting the Access token..
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })

    // Storing the accesstoken in a new valueand setting up a collection in Users with handle name .
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        userId,
        imageUrl:
          "https://firebasestorage.googleapis.com/v0/b/" +
          config.storageBucket +
          "/o/" +
          noImage +
          "?alt=media",
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    // Return the token
    .then(() => {
      return resp.status(200).json({ token });
    })

    // Catch the errors
    .catch((error) => {
      console.log("Error", error);
      if (error.code == "auth/email-already-in-use") {
        return resp.status(400).json({ email: "Email is already used. " });
      } else {
        return resp.status(500).json({ general: 'Something went wrong,  please try again.' });
      }
    });
};

exports.logIn = (req, resp) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };
  const { valid, errors } = validateLoginData(user);
  if (!valid) {
    return resp.status(400).json(errors);
  }
  // Firbase signin User Authentication
  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)

    // Return User Id Unique Token
    .then((data) => {
      return data.user.getIdToken();
    })

    // Return the token in JSON
    .then((token) => {
      return resp.json({ token });
    })

    // Handle the errors like user name or password invalid.
    .catch((error) => {
      console.error("Errors", error);
      if (error.code === "auth/wrong-password") {
        return resp
          .status(403)
          .json({ general: "Invalid username or password" });
      } else {
        return resp.status(500).json({ error: error.code });
      }
    });
};

exports.uploadImage = (req, resp) => {
  // Installed library
  const Busboy = require("busboy");
  // Default node package
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  // Loaded with the headers
  const busboy = new Busboy({
    headers: req.headers,
  });

  let imageFileName,
    imageToBeUploaded = {};
  busboy.on("file", (fieldName, file, fileName, encoding, mimetpe) => {
    console.log("Filed name", fieldName);
    console.log("File name", fieldName);
    console.log("Mime typr", mimetpe);
    if (mimetpe !== "image/jpeg" && mimetpe !== "image/png") {
      return resp.status(400).json("Wrong file type submitted.");
    }
    // Get the extensions
    const imageExtension = fileName.split(".")[fileName.split(".").length - 1];
    imageFileName = `${Math.round(
      Math.random() * 1000000000
    )}.${imageExtension}`;
    // Set the filepath node
    const filePath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filePath, mimetpe };
    file.pipe(fs.createWriteStream(filePath));
  });

  // Upload on fire base
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetpe,
          },
        },
      })
      .then(() => {
        const imageUrl =
          "https://firebasestorage.googleapis.com/v0/b/" +
          config.storageBucket +
          "/o/" +
          imageFileName +
          "?alt=media";
        // Update records
        return db.doc(`users/${req.user.handle}`).update({
          imageUrl,
        });
      })
      .then(() => {
        return resp.json({ message: "Image uploaded successfully" });
      })
      .catch((error) => {
        console.error("Error", error);
        resp.status(500).json({ error: error.code });
      });
  });
  busboy.end(req.rawBody);
};

// Add user details

exports.addUserDetails = (req, resp) => {
  let userDetails = reduceUserDetails(req.body);
  db.doc(`users/${req.user.handle}`)
    .update(userDetails)
    .then(() => {
      return resp.status(200).json("Details Added Successfully.");
    })
    .catch((err) => {
      console.error("Error", err);
      return resp.status(500).json({ error: err.code });
    });
};

// Get Own user details

exports.getAuthenticatedUser = (req, resp) => {
  let userData = {};
  db.doc(`users/${req.user.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection("likes")
          .where("userHandle", "==", req.user.handle)
          .get();
      }
    })
    .then((data) => {
      userData.likes = [];
      data.forEach((doc) => {
        userData.likes.push(doc.data());
      });
      // return resp.json(userData);
      return db
        .collection("notification")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    })
    .then((data) => {
      userData.notifications = [];
      data.forEach((doc) => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          type: doc.data().type,
          read: doc.data().read,
          screamId: doc.data().screamId,
          notificationsId: doc.id,
        });
      });
      return resp.json(userData);
    })
    .catch((err) => {
      console.log(err);
      return resp.status(500).json({ error: err.code });
    });
};

// Get any user details
exports.getUserDetails = (req, resp) => {
  let userData = {};
  db.doc(`/users/${req.params.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.user = doc.data();
        return db
          .collection("screams")
          .where("userHandle", "==", req.params.handle)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        resp.status(404).json({
          error: "User not found.",
        });
      }
    })
    .then((data) => {
      userData.sceams = [];
      data
        .forEach((doc) => {
          userData.sceams.push({
            body: doc.data().body,
            createdAt: doc.data().createdAt,
            userHandle: doc.data().userHandle,
            userImage: doc.data().userImage,
            likeCount: doc.data().likeCount,
            commentCount: doc.data().commentCount,
            screamId: doc.id,
          });
          return resp.json(userData);
        })
        .catch((err) => {
          console.error("Error", err);
          return json.status(500).json({
            error: err.code,
          });
        });
    });
};

// Reset the notification details
exports.markNotificationRead = (req, resp) => {
  // Batch right , Update multiple documents
  let batch = db.batch();
  req.body.forEach((notificationId) => {
    const notification = db.doc(`/notification/${notificationId}`);
    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return resp.json({ message: "Notification mark read" });
    })
    .catch((err) => {
      console.error(err);
      return resp.status(500).json({ error: err });
    });
};

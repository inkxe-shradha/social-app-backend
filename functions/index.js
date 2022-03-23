const functions = require("firebase-functions");
const express = require("express");
const FBAuth = require("./util/fbAuth");
const app = express();
const cors = require('cors');
app.use(cors());
// Import Routes
const {
  getAllScreams,
  postOneScream,
  getScream,
  commentOnScreen,
  likeScream,
  unLikeScream,
  deleteScream,
} = require("./handlers/screams");
const {
  signUp,
  logIn,
  uploadImage,
  addUserDetails,
  getUserDetails,
  markNotificationRead,
  getAuthenticatedUser,
} = require("./handlers/users");
const { db } = require("./util/admin");

/************************************************ FIREBASE DATABASE SERVICES *******************************************/

// Get the list of sceams by desc order
app.get("/screams", getAllScreams);
// Post a new sceams, Authentication Firebase webtoken, With the middlewares
app.post("/scream", FBAuth, postOneScream);
// TODOD get a scream
app.get("/scream/:screamId", getScream);
// TODO Delete a scream
app.delete("/scream/:screamId", FBAuth, deleteScream);
// TODO like a scream
app.get("/scream/:screamId/like", FBAuth, likeScream);
// TODO unlike a scream
app.get("/scream/:screamId/unlike", FBAuth, unLikeScream);
// TODO comment on  a scream
app.post("/scream/:screamId/comment", FBAuth, commentOnScreen);

/************************************************ FIREBASE AUTHENTICATION SERVICES *******************************************/
// Signup route
app.post("/signup", signUp);
// Login Route
app.post("/login", logIn);
// Upload image data
app.post("/user/image", FBAuth, uploadImage);
// Add user details
app.post("/user", FBAuth, addUserDetails);
// Get Users Data
app.get("/user", FBAuth, getAuthenticatedUser);
// Get user details
app.get("/user/:handle", getUserDetails);
// Reset the notification to read
app.post("/notifications", FBAuth, markNotificationRead);
/***************************************************************************************************************************** */

exports.api = functions.https.onRequest(app);

// Set notification like
exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db
            .doc(`/notification/${snapshot.id}`)
            .set({
              createdAt: new Date().toISOString(),
              recipient: doc.data().userHandle,
              sender: snapshot.data().userHandle,
              type: "like",
              read: false,
              screamId: doc.id,
            })
            .catch((err) => {
              console.error("Error", err);
            });
        }
      });
  });

// Create notification on comments
exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db
            .doc(`/notification/${snapshot.id}`)
            .set({
              createdAt: new Date().toISOString(),
              recipient: doc.data().userHandle,
              sender: snapshot.data().userHandle,
              type: "comment",
              read: false,
              screamId: doc.id,
            })
            .catch((err) => {
              console.error("Error", err);
            });
        }
      });
  });

// Delete notification on Unlike
exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notification/${snapshot.id}`)
      .delete()
      .catch((error) => {
        console.error("Error", error);
      });
  });

// Trigger event when the user image changes

exports.onUserImageChange = functions.firestore
  .document(`/users/{userId}`)
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("Image has been changed.");
      let batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

// On scream deleted this event will be fire.
exports.onScreamDeleted = functions.firestore
  .document(`screams/{screamId}`)
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("screamId", "==", screamId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db.collection("notification").where("screamId", "==", screamId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notification/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((error) => console.error("Error", error));
  });

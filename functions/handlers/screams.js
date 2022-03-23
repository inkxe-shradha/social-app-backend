const { db } = require("../util/admin");
const { json } = require("express");
exports.getAllScreams = (req, resp) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let screamArry = [];
      // Push the scream property into screem object
      data.forEach((doc) => {
        screamArry.push({
          screamId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage,
        });
      });
      return resp.status(200).json(screamArry);
    })
    .catch((ele) => {
      console.error(ele);
    });
};

exports.postOneScream = (req, resp) => {
  const newScream = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };

  // Adding a new screams
  db.collection("screams")
    .add(newScream)
    .then((doc) => {
      const respScream = newScream;
      respScream.screamId = doc.id;
      resp.json(respScream);
    })
    .catch((err) => {
      resp.status(500).json("Somthing went wrong");
      console.error("Error", err);
    });
};

exports.getScream = (req, resp) => {
  let screamData = {};
  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return resp.status(404).json({ error: "Screams not found" });
      }
      screamData = doc.data();
      screamData.screamId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("screamId", "==", req.params.screamId)
        .get();
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => {
        screamData.comments.push(doc.data());
      });
      return resp.json(screamData);
    })
    .catch((err) => {
      console.error("Error", err);
      resp.status(500).json({ error: err.code });
    });
};

// Save Comments
exports.commentOnScreen = (req, resp) => {
  if (req.body.body.trim() === "") {
    return resp.status(400).json({ error: "Comment must not be empty !" });
  }
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
  };
  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return resp.status(400).json({
          error: "Scream not found",
        });
      }
      return doc.ref.update({
        commentCount: doc.data().commentCount + 1,
      });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      return resp.json(newComment);
    })
    .catch((error) => {
      console.error("Eror", error);
      return json.status(500).json({
        error: error.code,
      });
    });
};

// Like a scream
exports.likeScream = (req, resp) => {
  // Get the likes from the collection
  const likeDocuments = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  //Store the single screm details

  const screamDocument = db.doc(`/screams/${req.params.screamId}`);
  let screamData = {};

  // Check the scream exit or not , If exit then return likes collection details
  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocuments.get();
      } else {
        resp.status(404).json({
          error: "Scream not found",
        });
      }
    })
    .then((data) => {
      // If there is no likes then Adding a likes
      if (data.empty) {
        return (
          db
            .collection("likes")
            .add({
              screamId: req.params.screamId,
              userHandle: req.user.handle,
            })
            // After adding likes, increment in Screams counts
            .then(() => {
              screamData.likeCount++;
              return screamDocument
                .update({
                  likeCount: screamData.likeCount,
                })
                .then(() => {
                  return resp.json(screamData);
                });
            })
        );
      } else {
        return resp.status(400).json({
          error: "Scream already liked !",
        });
      }
    })
    .catch((err) => {
      console.error("Error", err);
      return resp.status(500).json({
        error: err.code,
      });
    });
};

exports.unLikeScream = (req, resp) => {
  // Get the likes from the collection
  const likeDocuments = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  //Store the single screm details

  const screamDocument = db.doc(`/screams/${req.params.screamId}`);
  let screamData = {};

  // Check the scream exit or not , If exit then return likes collection details
  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocuments.get();
      } else {
        resp.status(404).json({
          error: "Scream not found",
        });
      }
    })
    .then((data) => {
      // If there is no likes then Adding a likes
      if (data.empty) {
        return resp.status(400).json({
          error: "Scream already liked !",
        });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return screamDocument
              .update({
                likeCount: screamData.likeCount,
              })
              .then(() => {
                return resp.json(screamData);
              });
          });
      }
    })
    .catch((err) => {
      console.error("Error", err);
      return resp.status(500).json({
        error: err.code,
      });
    });
};
// Delete a screams
exports.deleteScream = (req, resp) => {
  const document = db.doc(`/screams/${req.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return resp.status(400).json({ error: "Document does not exit." });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return resp.status(403).json({
          error: "Unauthrized Users",
        });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      return resp.json({
        message: "Scream deleted successfully.",
      });
    })
    .catch((err) => {
      console.error("Error", err);
      return res.status(500).json({
        err: err.code,
      });
    });
};

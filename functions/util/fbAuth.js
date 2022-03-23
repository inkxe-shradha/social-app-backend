const { admin, db } = require("./admin");

/**
 * This middle ware used for validate Webtoken in Firebase auth.
 * @param {*} req
 * @param {*} resp
 * @param {*} next
 */
module.exports = (req, resp, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No token found");
    return resp.status(403).json({ error: "Unauthorized" });
  }

  // Validate the web token
  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      req.user = decodedToken;
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then((data) => {
      req.user.handle = data.docs[0].data().handle;
      req.user.imageUrl= data.docs[0].data().imageUrl;
      return next();
    })
    .catch((error) => {
      console.error("Error while verifying token", error);
      return resp.status(403).json(error);
    });
};

// Validation for empty strings

const isEmpty = (string) => {
  if (string.trim() === "") {
    return true;
  } else {
    return false;
  }
};

// Email validation
const isEmail = (email) => {
  if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return true;
  }
  return false;
};

exports.validateSignupData = (newUser) => {
  //Inititalize Error object.
  let errors = {};
  if (isEmpty(newUser.email)) {
    errors.email = "Email does not to be empty.";
  } else if (!isEmail(newUser.email)) {
    errors.email = "Must be a valid email address.";
  }

  // Password Validate
  if (isEmpty(newUser.password)) {
    errors.password = "Password must not be Empty.";
  }

  // Confirm password
  if (newUser.password !== newUser.confirmPassword) {
    errors.confirmPassword = "Password must be the same";
  }

  // User handle Validate
  if (isEmpty(newUser.handle)) {
    errors.userhanle = "User handle must not be same.";
  }

  // Checking if there is a key in errors object , if yes then return

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateLoginData = (user) => {
  let errors = {};
  if (isEmpty(user.email)) {
    errors.email = "Email must be required";
  } else if (!isEmail(user.email)) {
    errors.email = "Must be a valid email address";
  }

  if (isEmpty(user.password)) {
    errors.password = "Password must not be empty";
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.reduceUserDetails = (data) => {
  let userDetails = {};

  if (!isEmpty(data.bio.trim())) {
    userDetails.bio = data.bio;
  }
  if (!isEmpty(data.website.trim())) {
    if (data.website.trim().substring(0, 4) !== "http") {
      userDetails.website = `http://${data.website.trim()}`;
    } else {
      userDetails.website = data.website;
    }
  }
  if (!isEmpty(data.location.trim())) {
    userDetails.location = data.location;
  }

  return userDetails;
};

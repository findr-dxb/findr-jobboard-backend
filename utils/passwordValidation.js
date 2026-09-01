const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const SPECIAL_CHAR = /[!@#$%^&*(),.?":{}|<>]/;

const PASSWORD_RULE_MESSAGE =
  "Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character.";

function isStrongPassword(password) {
  if (typeof password !== "string") return false;
  return (
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    SPECIAL_CHAR.test(password)
  );
}

module.exports = {
  PASSWORD_RULE_MESSAGE,
  isStrongPassword,
};

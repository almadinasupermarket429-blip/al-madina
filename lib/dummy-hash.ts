// A bcrypt hash (cost 10, same as real passwords) of a random throwaway string.
// Login compares against it when the email has no account, so a wrong email
// takes as long as a wrong password and the timing doesn't reveal who has an account.
export const DUMMY_PASSWORD_HASH = "$2a$10$ESPagekyM45Ed2wgO.iujep9xblO63eVKR.ZWjANefOqM3J50crrW";

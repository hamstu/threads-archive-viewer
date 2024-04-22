const users = [
  // paste your users.json here
];

const avatars = {
  // map of user id to avatar image
};

export function getUserById(userId: string, cdnHost: string) {
  const user = users.find((user) => user.id === userId);
  const avatarImage = avatars[userId as keyof typeof avatars];
  const avatarUrl = avatarImage ? `${cdnHost}/avatars/${avatarImage}` : null;
  if (!user) {
    return null;
  }
  return { ...user, avatarUrl };
}

export function getUserByEmail(email: string, cdnHost: string) {
  const user = users.find((user) => user.primaryEmail === email);
  const avatarImage = avatars[user?.id as keyof typeof avatars];
  const avatarUrl = avatarImage ? `${cdnHost}/avatars/${avatarImage}` : null;
  if (!user) {
    return null;
  }
  return { ...user, avatarUrl };
}

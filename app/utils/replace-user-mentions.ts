export function replaceUserMentionsWithLinks(markdown: string): string {
  // Define the regex with named groups for userID and name
  const userRegex = /<@(?<userID>\d+)\|(?<name>[^>]*)?>/g;
  // Replace each match in the markdown string
  return markdown.replace(userRegex, (match, ...args) => {
    // Extract named groups from the args. The groups object is always the last item.
    const groups = args[args.length - 1];
    // Return the markdown link using the userID and name from the groups
    return `[@${groups.name}](/user/${groups.userID})`;
  });
}

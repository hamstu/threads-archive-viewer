import { Link } from "@remix-run/react";
import { getUserById } from "~/services/users";
import { Thread } from "~/types/types";

export function ThreadsList({
  threads, cdnHost,
}: {
  threads: Thread[];
  cdnHost: string;
}) {
  return (
    <table className="threads-list">
      <tbody>
        {threads.map((thread) => {
          const threadAuthor = getUserById(thread.authorID, cdnHost);
          const formattedDate = Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(thread.createdAt));
          return (
            <tr key={thread.threadID}>
              <td>
                <Link to={`/thread/${thread.threadID}`}>
                  <b>{thread.title}</b>
                  <div className="threads-list-user">
                    <img
                      src={threadAuthor?.avatarUrl || ""}
                      alt=""
                      className="threads-list-avatar" />{" "}
                    {threadAuthor?.firstName} {threadAuthor?.lastName} •{" "}
                    {formattedDate}
                  </div>
                </Link>
              </td>
              <td></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

import { Link } from "@remix-run/react";
import { THREADS_PER_PAGE } from "../routes/channel.$channelID";

export function Pagination({
  pageNumber, threadsCount,
}: {
  pageNumber: number;
  threadsCount: number;
}) {
  const totalPages = Math.ceil(threadsCount / THREADS_PER_PAGE);
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  // if there'a lot of pages, modify the pages array to only be the current page and the 5 pages before and after
  if (totalPages > 10) {
    let start = Math.max(1, pageNumber - 5);
    let end = Math.min(totalPages, pageNumber + 5);
    if (end - start < 10) {
      if (start === 1) {
        end = 10;
      } else {
        start = end - 10;
      }
    }
    pages.splice(0, pages.length, ...Array.from({ length: end - start + 1 }, (_, i) => i + start));
  }
  return (
    <div className="pagination">
      {pageNumber > 1 && (
        <Link to={`?page=${pageNumber - 1}`} className="prev">
          ← Prev
        </Link>
      )}
      {pages.map((page) => (
        <Link
          key={page}
          to={`?page=${page}`}
          className={pageNumber === page ? "active" : ""}
        >
          {page}
        </Link>
      ))}
      {pageNumber < totalPages && (
        <Link to={`?page=${pageNumber + 1}`} className="next">
          Next →
        </Link>
      )}
    </div>
  );
}

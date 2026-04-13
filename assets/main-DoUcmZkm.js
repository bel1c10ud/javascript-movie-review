import { b as bindClickMovieEvent, r as renderSkeletonItems, f as fetchMovies, a as removeSkeletonItems, c as renderMovieItems, d as restoreScrollPosition, e as bindTopInfiniteScrollObserver, g as bindBottomInfiniteScrollObserver, h as handleError, i as getPage } from "./restoreScrollPosition-C0W-RRy1.js";
function renderTopRatedMovie(movie) {
  const containerEl = document.querySelector(".top-rated-movie");
  const rateEl = document.querySelector(".top-rated-movie .rate-value");
  const titleEl = document.querySelector(".top-rated-movie .title");
  const detailButtonEl = document.querySelector(
    ".top-rated-movie .detail"
  );
  const backgroundContainerEl = document.querySelector(
    ".background-container"
  );
  if (containerEl) {
    containerEl.dataset.movieId = movie.id.toString();
  }
  if (titleEl) {
    titleEl.textContent = movie.title;
  }
  if (rateEl) {
    rateEl.textContent = movie.vote_average.toFixed(1);
  }
  if (detailButtonEl) {
    detailButtonEl.disabled = false;
    if (detailButtonEl.dataset.isBound !== "true") {
      bindClickMovieEvent(detailButtonEl);
      detailButtonEl.dataset.isBound = "true";
    }
  }
  if (backgroundContainerEl) {
    backgroundContainerEl.style.backgroundImage = `url(${"https://image.tmdb.org/t/p"}/w1920_and_h800_multi_faces${movie.backdrop_path})`;
  }
}
let firstLoadedPage = null;
let lastLoadedPage = null;
let totalPages = 0;
async function renderPopularMoviePage(page, direction = "append") {
  if (firstLoadedPage === null || lastLoadedPage === null) {
    firstLoadedPage = page;
    lastLoadedPage = page;
  } else {
    firstLoadedPage = Math.min(firstLoadedPage, page);
    lastLoadedPage = Math.max(lastLoadedPage, page);
  }
  renderSkeletonItems(20, direction);
  const response = await fetchMovies("/movie/popular", { page });
  totalPages = response.total_pages;
  removeSkeletonItems();
  const isTopPage = page === firstLoadedPage;
  isTopPage && renderTopRatedMovie(response.results[0]);
  renderMovieItems(page, response.results, direction);
  restoreScrollPosition();
  const hasPrevPage = firstLoadedPage !== null && firstLoadedPage > 1;
  bindTopInfiniteScrollObserver(hasPrevPage, async () => {
    try {
      await renderPopularMoviePage(firstLoadedPage - 1, "prepend");
    } catch (error) {
      await handleError(error);
      removeSkeletonItems();
    }
  });
  const hasNextPage = totalPages > lastLoadedPage;
  bindBottomInfiniteScrollObserver(hasNextPage, async () => {
    try {
      await renderPopularMoviePage(lastLoadedPage + 1, "append");
    } catch (error) {
      await handleError(error);
      removeSkeletonItems();
    }
  });
}
addEventListener("load", async () => {
  try {
    await renderPopularMoviePage(getPage());
  } catch (error) {
    await handleError(error);
    removeSkeletonItems();
  }
});

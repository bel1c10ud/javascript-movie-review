import { r as renderSkeletonItems, f as fetchMovies, a as removeSkeletonItems, c as renderMovieItems, d as restoreScrollPosition, e as bindTopInfiniteScrollObserver, g as bindBottomInfiniteScrollObserver, h as handleError, j as getQuery, i as getPage } from "./restoreScrollPosition-C0W-RRy1.js";
function createSearchListrEmptyAlertTemplate() {
  return (
    /*html*/
    `
    <div class="empty-list-alert">
      <img src="${"/javascript-movie-review/"}svg/planet.svg" alt="행성이" />
      <p class="empty-list-message">검색 결과가 없습니다.</p>
    </div>
  `
  );
}
function renderSearchListEmptyAlert() {
  const listEl = document.querySelector(".thumbnail-list");
  if (!listEl) return;
  if (listEl.children.length === 0) {
    listEl.insertAdjacentHTML(
      "afterend",
      createSearchListrEmptyAlertTemplate()
    );
  } else {
    document.querySelector(".empty-list-alert")?.remove();
  }
}
let firstLoadedPage = null;
let lastLoadedPage = null;
let totalPages = 0;
async function renderSearchMoviePage(page, query, direction = "append") {
  if (firstLoadedPage === null || lastLoadedPage === null) {
    firstLoadedPage = page;
    lastLoadedPage = page;
  } else {
    firstLoadedPage = Math.min(firstLoadedPage, page);
    lastLoadedPage = Math.max(lastLoadedPage, page);
  }
  renderSkeletonItems(20, direction);
  const response = await fetchMovies("/search/movie", { query, page });
  totalPages = response.total_pages;
  removeSkeletonItems();
  renderMovieItems(page, response.results, direction);
  renderSearchListEmptyAlert();
  restoreScrollPosition();
  const hasPrevPage = firstLoadedPage !== null && firstLoadedPage > 1;
  bindTopInfiniteScrollObserver(hasPrevPage, async () => {
    try {
      await renderSearchMoviePage(firstLoadedPage - 1, query, "prepend");
    } catch (error) {
      await handleError(error);
      removeSkeletonItems();
    }
  });
  const hasNextPage = totalPages > lastLoadedPage;
  bindBottomInfiniteScrollObserver(hasNextPage, async () => {
    try {
      await renderSearchMoviePage(lastLoadedPage + 1, query, "append");
    } catch (error) {
      await handleError(error);
      removeSkeletonItems();
    }
  });
}
function renderSearchInput(query) {
  const searchInput = document.querySelector(".search-input");
  if (searchInput) searchInput.value = query;
}
function renderSearchListTitle(query) {
  const listTitleEl = document.querySelector(".list-title");
  if (listTitleEl) {
    listTitleEl.textContent = `"${query}" 검색 결과`;
  }
}
addEventListener("load", async () => {
  try {
    const query = getQuery();
    renderSearchInput(query);
    renderSearchListTitle(query);
    await renderSearchMoviePage(getPage(), query);
  } catch (error) {
    await handleError(error);
    removeSkeletonItems();
  }
});

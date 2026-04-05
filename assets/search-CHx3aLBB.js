import { r as renderSkeletonItems, f as fetchMoviesByPageRange, s as setPage, e as setQuery, a as removeSkeletonItems, b as renderMovieItemsToList, c as renderShowMoreButton, g as getPage, i as getQuery, h as handleError, d as renderTopRatedMovie } from "./renderTopRatedMovie-DN_vNPvA.js";
function renderSearchInput(query) {
  const searchInput = document.querySelector(".search-input");
  if (searchInput) searchInput.value = query;
}
function createSearchListrEmptyAlertTemplate() {
  return `
    <div class="empty-list-alert">
      <img src="${"/javascript-movie-review/"}svg/planet.svg" alt="행성이" />
      <p class="empty-list-message">검색 결과가 없습니다.</p>
    </div>
  `;
}
function renderSearchListrEmptyAlert() {
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
function renderSearchListTitle(query) {
  const listTitleEl = document.querySelector(".list-title");
  if (listTitleEl) {
    listTitleEl.textContent = `"${query}" 검색 결과`;
  }
}
addEventListener("load", async () => {
  let prevResponseList = [];
  try {
    async function renderSearchMoviePage(page, query) {
      renderSearchListTitle(query);
      renderSkeletonItems(20);
      const responseList = await fetchMoviesByPageRange(
        "/search/movie",
        prevResponseList.length,
        page,
        query
      );
      setPage(page);
      setQuery(query);
      removeSkeletonItems();
      prevResponseList.push(...responseList);
      const movieList = responseList.reduce((arr, response) => {
        return [...arr, ...response.results];
      }, []);
      renderMovieItemsToList(movieList);
      renderSearchListrEmptyAlert();
      renderShowMoreButton(prevResponseList, page, async () => {
        try {
          await renderSearchMoviePage(getPage() + 1, getQuery());
        } catch (error) {
          handleError(error);
        } finally {
          removeSkeletonItems();
        }
      });
    }
    renderSearchInput(getQuery());
    await renderSearchMoviePage(getPage(), getQuery());
    if (prevResponseList.length && prevResponseList[0].results.length) {
      renderTopRatedMovie(prevResponseList[0].results[0]);
    }
  } catch (error) {
    handleError(error);
  } finally {
    removeSkeletonItems();
  }
});

import { s as setPage, h as setQuery, i as renderListTitle, r as renderSkeletonItems, j as fetchSearchMoviesByPageRange, a as removeSkeletonItem, b as renderMovies, u as updateEmptyListAlert, c as renderShowMoreButton, g as getPage, k as getQuery, d as renderTopRatedMovie, e as showErrorToast } from "./toast-BmSTJZKB.js";
addEventListener("load", async () => {
  let prevResponseList = [];
  try {
    async function renderSearchMoviePage(page, query) {
      setPage(page);
      setQuery(query);
      renderListTitle(query);
      renderSkeletonItems(20);
      const responseList = await fetchSearchMoviesByPageRange(
        prevResponseList.length,
        page,
        query
      );
      removeSkeletonItem();
      prevResponseList.push(...responseList);
      const movieList = responseList.reduce((arr, response) => {
        return [...arr, ...response.results];
      }, []);
      renderMovies(movieList);
      updateEmptyListAlert();
      renderShowMoreButton(prevResponseList, page, () => {
        renderSearchMoviePage(getPage() + 1, getQuery());
      });
    }
    const searchInput = document.querySelector(".search-input");
    if (searchInput) searchInput.value = getQuery();
    await renderSearchMoviePage(getPage(), getQuery());
    if (prevResponseList.length && prevResponseList[0].results.length) {
      renderTopRatedMovie(prevResponseList[0].results[0]);
    }
  } catch (error) {
    if (error instanceof Error) {
      showErrorToast({ title: error.name, message: error.message });
    }
  }
});

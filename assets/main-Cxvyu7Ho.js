import { s as setPage, r as renderSkeletonItems, f as fetchPopularMoviesByPageRange, a as removeSkeletonItem, b as renderMovies, c as renderShowMoreButton, g as getPage, d as renderTopRatedMovie, e as showErrorToast } from "./toast-BmSTJZKB.js";
addEventListener("load", async () => {
  let prevResponseList = [];
  try {
    async function renderPopularMoviePage(page) {
      setPage(page);
      renderSkeletonItems(20);
      const responseList = await fetchPopularMoviesByPageRange(
        prevResponseList.length,
        page
      );
      removeSkeletonItem();
      prevResponseList.push(...responseList);
      const movieList = responseList.reduce((arr, response) => {
        return [...arr, ...response.results];
      }, []);
      renderMovies(movieList);
      renderShowMoreButton(prevResponseList, page, () => {
        renderPopularMoviePage(getPage() + 1);
      });
    }
    await renderPopularMoviePage(getPage());
    if (prevResponseList.length && prevResponseList[0].results.length) {
      renderTopRatedMovie(prevResponseList[0].results[0]);
    }
  } catch (error) {
    if (error instanceof Error) {
      showErrorToast({ title: error.name, message: error.message });
    }
  }
});

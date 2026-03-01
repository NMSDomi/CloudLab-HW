export const environment = {
  base: window.env.BACKEND_URL,
};

export const environmentUrls = {
    users: `${environment.base}api/user`,
    albums: `${environment.base}api/album`,
    pictures: `${environment.base}api/picture`,
};
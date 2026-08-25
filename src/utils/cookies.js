export const cookies = {
    // RENDER is checked alongside NODE_ENV because this repo's committed
    // .env pins NODE_ENV=development for local dev, and there's no way to
    // confirm from here whether Render's dashboard overrides it for the
    // live deploy — without this, the auth token cookie set below would
    // silently ship without the Secure flag in production.
    getOptions: () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    }),

    set: (res, name, value, options = {}) => {
        res.cookie(name, value, { ...cookies.getOptions(), ...options});
    },

    clear: (res, name, options = {}) => {
        res.clearCookie(name, { ...cookies.getOptions(), ...options});
    },

    get: (req, name) => {
        return req.cookies[name];
    }
};
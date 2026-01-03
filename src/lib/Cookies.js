const setCookies = (res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSiteValue = isProd ? 'none' : 'lax';

    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: sameSiteValue,
        maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: sameSiteValue,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
}

export default setCookies;
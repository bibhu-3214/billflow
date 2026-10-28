module.exports = () => {
    const production = process.env.EAS_BUILD_PROFILE === 'production';
    const api = process.env.EXPO_PUBLIC_API_ORIGIN || '';
    if (production && (!/^https:\/\/[^/]+$/.test(api) || !process.env.BILLFLOW_APP_ID || !process.env.BILLFLOW_EAS_PROJECT_ID)) {
        throw new Error('Production needs an HTTPS API origin, an owned app ID and an EAS project ID.');
    }
    return {
        name: 'BillFlow', slug: 'billflow', version: '0.1.0', orientation: 'portrait',
        scheme: 'billflow', userInterfaceStyle: 'automatic',
        ios: { bundleIdentifier: process.env.BILLFLOW_APP_ID || 'local.billflow.development', supportsTablet: true,
            infoPlist: { ITSAppUsesNonExemptEncryption: false } },
        android: { package: process.env.BILLFLOW_APP_ID || 'local.billflow.development', allowBackup: false },
        plugins: ['expo-secure-store'], updates: { enabled: false },
        extra: process.env.BILLFLOW_EAS_PROJECT_ID ? { eas: { projectId: process.env.BILLFLOW_EAS_PROJECT_ID } } : {},
    };
};

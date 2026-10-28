import browserData, { encryptPortableBackup } from './browserData';
import cloudData, { isCloudMode } from './cloudData';

const data = isCloudMode ? {
    ...cloudData,
    async exportBackup(password) {
        const result = await cloudData.exportWorkspace();
        const profile = { ...result.profile, businessName: result.workspace.settings.name || result.profile.businessName,
            address: result.workspace.settings.address || result.profile.address };
        return encryptPortableBackup(result.workspace, profile, password);
    },
} : browserData;

export default data;

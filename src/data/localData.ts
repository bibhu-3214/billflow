import type { UserProfile, Workspace } from '../types/domain';
import { captureSession } from '../utils/sessionBoundary';
import browserData, { encryptPortableBackup } from './browserData';
import cloudData, { isCloudMode } from './cloudData';

const data = isCloudMode ? {
    ...cloudData,
    async exportBackup(password?: string) {
        if (!password) throw new Error('Choose a backup password.');
        const current = captureSession();
        const result = await cloudData.exportWorkspace();
        const profile = { ...result.profile, businessName: result.workspace.settings.name || result.profile.businessName,
            address: result.workspace.settings.address || result.profile.address };
        const backup = await encryptPortableBackup(result.workspace, profile, password);
        current();
        return backup;
    },
} : browserData;

export default data;

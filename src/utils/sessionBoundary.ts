// No identity or secrets: this generation only cancels work spanning a session change.
let generation = 0;
export const changeSession = () => { generation += 1; };
export const captureSession = () => {
    const captured = generation;
    return () => {
        if (captured !== generation) {
            throw Object.assign(new Error('The account changed. Reopen this screen.'), { cancelled: true });
        }
    };
};

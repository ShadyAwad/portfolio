export const socketFor = step => step.socket ?? (['auth', 'tenant'].includes(step.node) ? 'access' : step.node);

const workspaceSlots = {
    browser: [13, 51, 24, 24], api: [38, 32, 75, 24], access: [62, 59, 75, 65], postgres: [86, 36, 24, 65]
};
const compactWorkspace = { ...workspaceSlots, api: [49, 29, 75, 24], postgres: [85, 54, 30, 66] };

export function requestLayout(steps, variant) {
    const sockets = [...new Set(steps.map(socketFor))];
    const branches = new Set(steps.filter(step => step.channel === 'background').map(socketFor));
    const main = sockets.filter(socket => !branches.has(socket));
    const branch = sockets.filter(socket => branches.has(socket));
    const workspace = sockets.includes('access') ? workspaceSlots : compactWorkspace;
    const nodes = sockets.map((key, index) => {
        const row = Math.floor(index / 2);
        const column = index % 2;
        const mobileX = (row % 2 ? 1 - column : column) ? 74 : 26;
        const mobileY = (row + .52) / Math.ceil(sockets.length / 2) * 88;
        const branchIndex = branch.indexOf(key);
        const mainIndex = main.indexOf(key);
        const slot = variant === 'workspace' ? workspace[key] : null;
        const position = slot ?? [
            branchIndex < 0 ? 12 + 76 * mainIndex / Math.max(1, main.length - 1) : 34 + 44 * branchIndex,
            branchIndex < 0 ? (mainIndex % 2 ? 25 : 43) : 67 + 4 * branchIndex,
            mobileX, mobileY
        ];
        return { key, position };
    });
    const links = steps.map((step, index) => ({
        from: step.branchFrom
            ? steps.slice(0, index).findLastIndex(candidate => candidate.node === step.branchFrom)
            : index - 1,
        channel: step.channel ?? 'request'
    }));
    const entry = steps.findIndex(step => socketFor(step) !== sockets[0]);
    return { nodes, links, entry, mobileHeight: Math.max(245, Math.ceil(sockets.length / 2) * 101) };
}

export function journeyOutcomes(steps, index) {
    return new Set(steps.slice(0, index + 1).map(step => step.outcome).filter(Boolean));
}

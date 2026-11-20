export const STELLAR_DURATION = 36;

export class StellarPlayback {
    state = 'IDLE';
    elapsed = 0;
    returned = 0;

    activate() {
        if (this.state !== 'IDLE') return false;
        this.state = 'PLAYING';
        this.elapsed = this.returned = 0;
        return true;
    }

    advance(dt) {
        if (this.state === 'PLAYING') {
            this.elapsed = Math.min(STELLAR_DURATION, this.elapsed + dt);
            if (this.elapsed === STELLAR_DURATION) this.state = 'RETURNING';
        } else if (this.state === 'RETURNING') {
            this.returned = Math.min(2, this.returned + dt);
            if (this.returned === 2) this.reset();
        }
    }

    reset() {
        this.state = 'IDLE';
        this.elapsed = this.returned = 0;
    }
}

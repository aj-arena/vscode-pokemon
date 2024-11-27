import { PokemonColor, PokemonGeneration, PokemonSize, PokemonSpeed } from '../common/types';
import { IPokemonType } from './states';
import { ISequenceTree } from './sequences';
import {
    States,
    IState,
    resolveState,
    PetInstanceState,
    isStateAboveGround,
    BallState,
    ChaseState,
    HorizontalDirection,
    FrameResult,
} from './states';

export class InvalidStateError extends Error {
    fromState: States;
    petType: string;

    constructor(fromState: States, petType: string) {
        super(`Invalid state ${fromState} for pet type ${petType}`);
        this.fromState = fromState;
        this.petType = petType;
    }
}

export abstract class BasePetType implements IPokemonType {
    label: string = 'base';
    static count: number = 0;
    sequence: ISequenceTree = {
        startingState: States.sitIdle,
        sequenceStates: [],
    };
    static possibleColors: PokemonColor[];
    currentState: IState;
    currentStateEnum: States;
    holdState: IState | undefined;
    holdStateEnum: States | undefined;
    private el: HTMLImageElement;
    private collision: HTMLDivElement;
    private speech: HTMLDivElement;
    private _left: number;
    private _bottom: number;
    petRoot: string;
    _floor: number;
    _friend: IPokemonType | undefined;
    private _name: string;
    private _speed: number;
    private _size: PokemonSize;

    constructor(
        spriteElement: HTMLImageElement,
        collisionElement: HTMLDivElement,
        speechElement: HTMLDivElement,
        size: PokemonSize,
        left: number,
        bottom: number,
        petRoot: string,
        floor: number,
        name: string,
        speed: number,
    ) {
        this.el = spriteElement;
        this.collision = collisionElement;
        this.speech = speechElement;
        this.petRoot = petRoot;
        this._floor = floor;
        this._left = left;
        this._bottom = bottom;
        this.initSprite(size, left, bottom);
        this.currentStateEnum = this.sequence.startingState;
        this.currentState = resolveState(this.currentStateEnum, this);

        this._name = name;
        this._size = size;
        this._speed = this.randomizeSpeed(speed);

        // Increment the static count of the Pet class that the constructor belongs to
        (this.constructor as any).count += 1;
    }

    initSprite(petSize: PokemonSize, left: number, bottom: number) {
        // Store size for later use
        this._size = petSize;

        // Position elements
        this.el.style.left = `${left}px`;
        this.el.style.bottom = `${bottom}px`;

        // Calculate size based on petSize
        const spriteSize = this.calculateSpriteWidth(petSize);

        // Apply size to sprite
        this.el.style.width = `${spriteSize}px`;
        this.el.style.height = `${spriteSize}px`;

        // Apply size to collision box
        this.collision.style.left = `${left}px`;
        this.collision.style.bottom = `${bottom}px`;
        this.collision.style.width = `${spriteSize}px`;
        this.collision.style.height = `${spriteSize}px`;

        // Position speech bubble above sprite
        this.speech.style.left = `${left}px`;
        this.speech.style.bottom = `${bottom + spriteSize}px`;

        // Hide speech bubble initially
        this.hideSpeechBubble();

        // Add size class for any CSS-based styling
        this.el.className = `pet pet-${petSize}`;
        this.collision.className = `collision pet-${petSize}`;
    }

    get left(): number {
        return this._left;
    }

    get bottom(): number {
        return this._bottom;
    }

    private repositionAccompanyingElements() {
        this.collision.style.left = `${this._left}px`;
        this.collision.style.bottom = `${this._bottom}px`;
        this.speech.style.left = `${this._left}px`;
        this.speech.style.bottom = `${this._bottom + this.calculateSpriteWidth(this._size)
            }px`;
    }

    calculateSpriteWidth(size: PokemonSize): number {
        switch (size) {
            case PokemonSize.nano:
                return 32;
            case PokemonSize.small:
                return 48;
            case PokemonSize.medium:
                return 64;
            case PokemonSize.large:
                return 80;
            default:
                return 32;
        }
    }

    positionBottom(bottom: number): void {
        this._bottom = bottom;
        this.el.style.bottom = `${this._bottom}px`;
        this.repositionAccompanyingElements();
    }

    positionLeft(left: number): void {
        this._left = left;
        this.el.style.left = `${this._left}px`;
        this.repositionAccompanyingElements();
    }

    get width(): number {
        return this.el.width;
    }

    get floor(): number {
        return this._floor;
    }

    get hello(): string {
        // return the sound of the name of the animal
        return ` says hello 👋!`;
    }

    getState(): PetInstanceState {
        return { currentStateEnum: this.currentStateEnum };
    }

    get speed(): number {
        return this._speed;
    }

    randomizeSpeed(speed: number): number {
        const min = speed * 0.7;
        const max = speed * 1.3;
        const newSpeed = Math.random() * (max - min) + min;
        return newSpeed;
    }

    get isMoving(): boolean {
        return this._speed !== PokemonSpeed.still;
    }

    recoverFriend(friend: IPokemonType) {
        // Recover friends..
        this._friend = friend;
    }

    recoverState(state: PetInstanceState) {
        // TODO : Resolve a bug where if it was swiping before, it would fail
        // because holdState is no longer valid.
        this.currentStateEnum = state.currentStateEnum ?? States.sitIdle;
        this.currentState = resolveState(this.currentStateEnum, this);

        if (!isStateAboveGround(this.currentStateEnum)) {
            // Reset the bottom of the sprite to the floor as the theme
            // has likely changed.
            this.positionBottom(this.floor);
        }
    }

    get canSwipe() {
        return !isStateAboveGround(this.currentStateEnum);
    }

    get canChase() {
        return !isStateAboveGround(this.currentStateEnum) && this.isMoving;
    }

    showSpeechBubble(message: string, duration: number = 3000) {
        this.speech.innerHTML = message;
        this.speech.style.display = 'block';
        setTimeout(() => {
            this.hideSpeechBubble();
        }, duration);
    }

    hideSpeechBubble() {
        this.speech.style.display = 'none';
    }

    swipe() {
        if (this.currentStateEnum === States.swipe) {
            return;
        }
        this.holdState = this.currentState;
        this.holdStateEnum = this.currentStateEnum;
        this.currentStateEnum = States.swipe;
        this.currentState = resolveState(this.currentStateEnum, this);
        this.showSpeechBubble('👋');
    }

    chase(ballState: BallState, canvas: HTMLCanvasElement) {
        this.currentStateEnum = States.chase;
        this.currentState = new ChaseState(this, ballState, canvas);
    }

    faceLeft() {
        this.el.style.transform = 'scaleX(-1)';
    }

    faceRight() {
        this.el.style.transform = 'scaleX(1)';
    }

    setAnimation(face: string) {
        if (this.el.src.endsWith(`_${face}_8fps.gif`)) {
            return;
        }
        this.el.src = `${this.petRoot}_${face}_8fps.gif`;
    }

    chooseNextState(fromState: States): States {
        // Work out next state
        var possibleNextStates: States[] | undefined = undefined;
        for (var i = 0; i < this.sequence.sequenceStates.length; i++) {
            if (this.sequence.sequenceStates[i].state === fromState) {
                possibleNextStates =
                    this.sequence.sequenceStates[i].possibleNextStates;
            }
        }
        if (!possibleNextStates) {
            throw new InvalidStateError(fromState, this.label);
        }
        // randomly choose the next state
        const idx = Math.floor(Math.random() * possibleNextStates.length);
        return possibleNextStates[idx];
    }

    nextFrame() {
        if (
            this.currentState.horizontalDirection === HorizontalDirection.left
        ) {
            this.faceLeft();
        } else if (
            this.currentState.horizontalDirection === HorizontalDirection.right
        ) {
            this.faceRight();
        }
        this.setAnimation(this.currentState.spriteLabel);

        // What's my buddy doing?
        if (
            this.hasFriend &&
            this.currentStateEnum !== States.chaseFriend &&
            this.isMoving
        ) {
            if (
                this.friend?.isPlaying &&
                !isStateAboveGround(this.currentStateEnum)
            ) {
                this.currentState = resolveState(States.chaseFriend, this);
                this.currentStateEnum = States.chaseFriend;
                return;
            }
        }

        var frameResult = this.currentState.nextFrame();
        if (frameResult === FrameResult.stateComplete) {
            // If recovering from swipe..
            if (this.holdState && this.holdStateEnum) {
                this.currentState = this.holdState;
                this.currentStateEnum = this.holdStateEnum;
                this.holdState = undefined;
                this.holdStateEnum = undefined;
                return;
            }

            var nextState = this.chooseNextState(this.currentStateEnum);
            this.currentState = resolveState(nextState, this);
            this.currentStateEnum = nextState;
        } else if (frameResult === FrameResult.stateCancel) {
            if (this.currentStateEnum === States.chase) {
                var nextState = this.chooseNextState(States.idleWithBall);
                this.currentState = resolveState(nextState, this);
                this.currentStateEnum = nextState;
            } else if (this.currentStateEnum === States.chaseFriend) {
                var nextState = this.chooseNextState(States.idleWithBall);
                this.currentState = resolveState(nextState, this);
                this.currentStateEnum = nextState;
            }
        }
    }

    get hasFriend(): boolean {
        return this._friend !== undefined;
    }

    get friend(): IPokemonType | undefined {
        return this._friend;
    }

    get name(): string {
        return this._name;
    }

    makeFriendsWith(friend: IPokemonType): boolean {
        this._friend = friend;
        console.log(this.name, ": I'm now friends ❤️ with ", friend.name);
        return true;
    }

    get isPlaying(): boolean {
        return (
            this.isMoving &&
            (this.currentStateEnum === States.runRight ||
                this.currentStateEnum === States.runLeft)
        );
    }

    get emoji(): string {
        return '🐶';
    }
}

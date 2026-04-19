import { Injectable } from "@nestjs/common";
import { Observable , Subject } from "rxjs";

@Injectable()
export class SseService {
    constructor(
    ) {}

     private readonly Stream = new Subject<{signal: string}>()
    
    triggerRefreshSignal() {
        this.Stream.next({ signal: 'refresh' });
    }

    getRefreshSignal(): Observable<{signal: string}> {
        return this.Stream.asObservable();
    }

}
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ModalDirective } from 'ng2-bootstrap/components/modal';
import { MetaService } from 'ng2-meta';

import { Video, VideoService } from '../shared';
import { WebTorrentService } from './webtorrent.service';

@Component({
  selector: 'my-video-watch',
  templateUrl: './video-watch.component.html',
  styleUrls: [ './video-watch.component.scss' ]
})

export class VideoWatchComponent implements OnInit, OnDestroy {
  private static LOADTIME_TOO_LONG: number = 30000;

  @ViewChild('magnetUriModal') magnetUriModal: ModalDirective;

  downloadSpeed: number;
  error: boolean = false;
  loading: boolean = false;
  numPeers: number;
  uploadSpeed: number;
  video: Video = null;

  private errorTimer: NodeJS.Timer;
  private sub: any;
  private torrentInfosInterval: NodeJS.Timer;

  constructor(
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private metaService: MetaService,
    private webTorrentService: WebTorrentService
  ) {}

  ngOnInit() {
    this.sub = this.route.params.subscribe(routeParams => {
      let id = routeParams['id'];
      this.videoService.getVideo(id).subscribe(
        video => {
          this.video = video;
          this.setOpenGraphTags();
          this.loadVideo();
        },
        error => alert(error.text)
      );
    });
  }

  ngOnDestroy() {
    console.log('Removing video from webtorrent.');
    clearInterval(this.torrentInfosInterval);
    clearTimeout(this.errorTimer);
    this.webTorrentService.remove(this.video.magnetUri);

    this.sub.unsubscribe();
  }

  loadVideo() {

    console.log('<iframe width="560" height="315" src="' + window.location.origin + '/videos/embed/' + this.video.id + '" frameborder="0" allowfullscreen></iframe>');

    // Reset the error
    this.error = false;
    // We are loading the video
    this.loading = true;

    console.log('Adding ' + this.video.magnetUri + '.');

    // The callback might never return if there are network issues
    // So we create a timer to inform the user the load is abnormally long
    this.errorTimer = setTimeout(() => this.loadTooLong(), VideoWatchComponent.LOADTIME_TOO_LONG);

    this.webTorrentService.add(this.video.magnetUri, (torrent) => {
      // Clear the error timer
      clearTimeout(this.errorTimer);
      // Maybe the error was fired by the timer, so reset it
      this.error = false;

      // We are not loading the video anymore
      this.loading = false;

      console.log('Added ' + this.video.magnetUri + '.');
      torrent.files[0].appendTo(this.elementRef.nativeElement.querySelector('.embed-responsive'), (err) => {
        if (err) {
          alert('Cannot append the file.');
          console.error(err);
        }
      });

      this.runInProgress(torrent);
    });
  }

  showMagnetUriModal() {
    this.magnetUriModal.show();
  }

  hideMagnetUriModal() {
    this.magnetUriModal.hide();
  }

  private loadTooLong() {
    this.error = true;
    console.error('The video load seems to be abnormally long.');
  }

  private setOpenGraphTags() {
    this.metaService.setTag('og:type', 'video');

    this.metaService.setTag('og:title', this.video.name);
    this.metaService.setTag('name', this.video.name);

    this.metaService.setTag('og:description', this.video.description);
    this.metaService.setTag('description', this.video.description);

    this.metaService.setTag('og:image', this.video.thumbnailPath);

    this.metaService.setTag('og:duration', this.video.duration);

    this.metaService.setTag('og:site_name', 'PeerTube');

    this.metaService.setTag('og:url', window.location.href);
    this.metaService.setTag('url', window.location.href);
  }

  private runInProgress(torrent: any) {
    // Refresh each second
    this.torrentInfosInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.downloadSpeed = torrent.downloadSpeed;
        this.numPeers = torrent.numPeers;
        this.uploadSpeed = torrent.uploadSpeed;
      });
    }, 1000);
  }
}

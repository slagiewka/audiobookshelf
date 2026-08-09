const assert = require('node:assert/strict')
const { describe, it, beforeEach } = require('node:test')
const sinon = require('sinon')
const TrackProgressMonitor = require('../../../server/objects/TrackProgressMonitor')


describe('TrackProgressMonitor', () => {
  let trackDurations
  let trackStartedCallback
  let progressCallback
  let trackFinishedCallback
  let monitor

  beforeEach(() => {
    trackDurations = [10, 40, 50]
    trackStartedCallback = sinon.spy()
    progressCallback = sinon.spy()
    trackFinishedCallback = sinon.spy()
  })

  it('should initialize correctly', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)

    assert.deepStrictEqual(monitor.trackDurations, trackDurations)
    assert.strictEqual(monitor.totalDuration, 100)
    assert.strictEqual(monitor.trackStartedCallback, trackStartedCallback)
    assert.strictEqual(monitor.progressCallback, progressCallback)
    assert.strictEqual(monitor.trackFinishedCallback, trackFinishedCallback)
    assert.strictEqual(monitor.currentTrackIndex, 0)
    assert.strictEqual(monitor.cummulativeProgress, 0)
    assert.strictEqual(monitor.currentTrackPercentage, 10)
    assert.strictEqual(monitor.numTracks, trackDurations.length)
    assert.strictEqual(monitor.allTracksFinished, false)
  })

  it('should update the progress', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)

    assert.strictEqual(monitor.currentTrackIndex, 0)
    assert.strictEqual(monitor.cummulativeProgress, 0)
    assert.strictEqual(monitor.currentTrackPercentage, 10)
    assert.strictEqual(trackStartedCallback.calledOnceWithExactly(0), true)
    assert.strictEqual(progressCallback.calledOnceWithExactly(0, 50, 5), true)
    assert.strictEqual(trackFinishedCallback.notCalled, true)
  })

  it('should update the progress multiple times on the same track', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)
    monitor.update(7)

    assert.strictEqual(monitor.currentTrackIndex, 0)
    assert.strictEqual(monitor.cummulativeProgress, 0)
    assert.strictEqual(monitor.currentTrackPercentage, 10)
    assert.strictEqual(trackStartedCallback.calledOnceWithExactly(0), true)
    assert.strictEqual(progressCallback.calledTwice, true)
    assert.strictEqual(progressCallback.calledWithExactly(0, 50, 5), true)
    assert.strictEqual(progressCallback.calledWithExactly(0, 70, 7), true)
    assert.strictEqual(trackFinishedCallback.notCalled, true)
  })

  it('should update the progress multiple times on different tracks', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)
    monitor.update(20)

    assert.strictEqual(monitor.currentTrackIndex, 1)
    assert.strictEqual(monitor.cummulativeProgress, 10)
    assert.strictEqual(monitor.currentTrackPercentage, 40)
    assert.strictEqual(trackStartedCallback.calledTwice, true)
    assert.strictEqual(trackStartedCallback.calledWithExactly(0), true)
    assert.strictEqual(trackStartedCallback.calledWithExactly(1), true)
    assert.strictEqual(progressCallback.calledTwice, true)
    assert.strictEqual(progressCallback.calledWithExactly(0, 50, 5), true)
    assert.strictEqual(progressCallback.calledWithExactly(1, 25, 20), true)
    assert.strictEqual(trackFinishedCallback.calledOnceWithExactly(0), true)
  })

  it('should finish all tracks', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.finish()

    assert.strictEqual(monitor.allTracksFinished, true)
    assert.strictEqual(trackStartedCallback.calledThrice, true)
    assert.strictEqual(trackFinishedCallback.calledThrice, true)
    assert.strictEqual(progressCallback.notCalled, true)
    assert.strictEqual(trackStartedCallback.calledWithExactly(0), true)
    assert.strictEqual(trackFinishedCallback.calledWithExactly(0), true)
    assert.strictEqual(trackStartedCallback.calledWithExactly(1), true)
    assert.strictEqual(trackFinishedCallback.calledWithExactly(1), true)
    assert.strictEqual(trackStartedCallback.calledWithExactly(2), true)
    assert.strictEqual(trackFinishedCallback.calledWithExactly(2), true)
  })
})

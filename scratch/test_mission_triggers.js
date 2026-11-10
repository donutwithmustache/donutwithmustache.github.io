import { MissionManager } from '../js/mission.js';

// Mock game object
const mockGame = {
  world: { mapSize: 30000, halfMapSize: 15000, islands: [] },
  physics: { reset: () => {} },
  targetManager: {
    targets: [
      { id: 'ace_su37', name: 'Yellow 13', type: 'air', isDestroyed: false, isFalling: false, hp: 120, maxHp: 120 }
    ]
  }
};

const missionData = {
  missionType: 'singleplayer',
  map: { id: 'test', size: 30000 },
  dynamics: {
    triggers: [
      {
        id: 'trig_timed_dialogue',
        name: 'Timed AWACS Warning',
        event: 'TIMER',
        time: 5.0,
        actions: [{ type: 'DIALOGUE', speaker: 'ASTRA', text: '5 seconds elapsed.' }]
      },
      {
        id: 'trig_target_kill',
        name: 'Ace Down',
        event: 'TARGET_DESTROYED',
        targetId: 'ace_su37',
        actions: [{ type: 'DIALOGUE', speaker: 'ASTRA', text: 'Yellow 13 shot down!' }]
      }
    ]
  }
};

const mm = new MissionManager(mockGame);
mm.applyMission(missionData);

console.log('Triggers count:', mm.triggers.length);
console.log('Initial firedTriggers count:', mm.firedTriggers.size);

// Simulate time advancing 0 to 4s (should not fire TIMER 5.0)
mm.update(4.0, { x: 0, y: 0 });
console.log('At 4.0s - Fired triggers:', Array.from(mm.firedTriggers));
if (mm.firedTriggers.has('trig_timed_dialogue')) {
  throw new Error('Timer fired too early!');
}

// Simulate time advancing to 5.5s (should fire TIMER 5.0)
mm.update(1.5, { x: 0, y: 0 });
console.log('At 5.5s - Fired triggers:', Array.from(mm.firedTriggers));
if (!mm.firedTriggers.has('trig_timed_dialogue')) {
  throw new Error('Timer failed to fire at 5.5s!');
}

// Target Destroyed test:
// Target is still alive, so trig_target_kill should NOT have fired yet
if (mm.firedTriggers.has('trig_target_kill')) {
  throw new Error('Target destroyed trigger fired while target was still alive!');
}

// Now destroy the target
mockGame.targetManager.targets[0].isDestroyed = true;
mockGame.targetManager.targets[0].hp = 0;

mm.update(0.1, { x: 0, y: 0 });
console.log('After target destroyed - Fired triggers:', Array.from(mm.firedTriggers));
if (!mm.firedTriggers.has('trig_target_kill')) {
  throw new Error('Target destroyed trigger failed to fire after target destruction!');
}

console.log('>>> ALL JS MISSION TRIGGER TESTS PASSED! <<<');


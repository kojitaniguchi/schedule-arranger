'use strict'
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');


describe('/login', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('ログインのためのリンクが含まれる', (done) => {
    request(app)
      .get('/login')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(/<a href="\/auth\/github"/)
      .expect(200, done);
  });

  it('ログイン時はユーザ名が表示される', (done) => {
    request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200, done)
  });
});

describe('/logout', () => {
  it('/ にリダイレクトされる', (done) => {
    request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302, done);
  });
});

describe('/schedules/:scheduleId/user/:userId/candidates/:candidateId', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('出欠更新ができる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1'})
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1];
          Candidate.findOne({
            where: { scheduleId: scheduleId }
          }).then((Candidate) => {
            //更新がされることをテスト
            request(app)
            .post(`/schedules/${scheduleId}/users/${0}/candidates/${Candidate.candidateId}`)
            .send({ availability:2 }) //出席に更新
            .expect('{"status":"OK","availability":2}')
            .end((err, res) => { deleteScheduleAggregate(scheduleId, done, err); });
          });
        });
    });
  });
});

function deleteScheduleAggregate(scheduleId, done, err) {
  Availability.findAll({
    where: { scheduleId: scheduleId }
  }).then((availabilities) => {
    const promises = availabilities.map((a) => { return a.destroy(); });
    Promise.all(promises).then(() => {
      Candidate.findAll({
        where: {scheduleId: scheduleId }
      }).then((candidates) => {
        const promises = candidates.map((c) => { return c.destroy(); });
        Promise.all(promises).then(() => {
          Schedule.findById(scheduleId).then((s) => { s.destroy(); });
          if (err) return done(err);
          done();
        });
      });
    });
  });
}

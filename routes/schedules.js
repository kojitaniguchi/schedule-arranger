'use strict'
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('node-uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

router.get('/new', authenticationEnsurer, csrfProtection, (req, res, next) => {
  res.render('new', { user: req.user, csrfToken: req.csrfToken() });
});

router.post('/', authenticationEnsurer, csrfProtection, (req, res, next) => {
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255),
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule) => {
    createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
  });
});

router.get('/:scheduleId', authenticationEnsurer, (req, res, next) => {
  Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username']
      }],
    where: {
      scheduleId: req.params.scheduleId
    },
    order: '"updatedAt" DESC'
  }).then((schedule) => {
    if (schedule) {
      Candidate.findAll({
        where: { scheduleId: schedule.scheduleId },
        order: '"candidateId" ASC'
      }).then((candidates) => {
          //データベースからその予定の全ての出欠を取得する
          Availability.findAll({
            include: [
              {
                model: User,
                attributes: ['userId', 'username']
              }
            ],
            where: { scheduleId: schedule.scheduleId },
            order: '"user.username" ASC, "candidateId" ASC'
          }).then((availabilities) => {
            //出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) の作成
            const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, availability)
            availabilities.forEach((a) => {
              const map = availabilityMapMap.get(a.user.userId) || new Map();
              map.set(a.CandidateId, a.availability);
              availabilityMapMap.set(a.user.userId, map);
            });

            // 閲覧ユーザーと出欠に紐づくユーザーからユーザーMap (キー:ユーザー ID, 値:ユーザー) を作る
            const userMap = new Map(); //// key: userId, value: User
            userMap.set(parseInt(req.user.id), {
              isSelf: true,
              userId: parseInt(req.user.id),
              username: req.user.username
            });
            availabilities.forEach((a) => {
              userMap.set(parseInt(req.user.id),{
                isSelf: parseInt(req.user.id) === a.user.userId, // 閲覧ユーザー自身であるかを含める
                userId: a.user.userId,
                username: a.user.username
              });
            });

            //全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
            const users = Array.from(userMap).map((keyValue) => keyValue[1]);
            users.forEach((u) => {
              candidates.forEach((c) => {
                const map = availabilityMapMap.get(u.userId) || new Map();
                const a = map.get(c.candidateId) || 0; //デフォルトは０を利用
                map.set(c.candidateId, a);
                availabilityMapMap.set(u.userId, map);
              });
            });
            //コメント取得
            Comment.findAll({
              where: { scheduleId: schedule.scheduleId }
            }).then((Comments) => {
              const commentMap = new Map();
              Comments.forEach((comment) => {
                commentMap.set(comment.userId, comment.comment);
              });
              res.render('schedule', {
                user: req.user,
                schedule: schedule,
                candidates: candidates,
                users: users,
                availabilityMapMap: availabilityMapMap,
                commentMap: commentMap
              });
            });
          });
        });
    } else {
      const err = new Error('指定された予定は見つかりません');
      err.status = 404;
      next(err);
    }
  });
});

router.get('/:scheduleId/edit', authenticationEnsurer, csrfProtection, (req, res, next) => {
  Schedule.findOne({
    where: {
      scheduleId: req.params.scheduleId
    }
  }).then((schedule) => {
    if (isMine(req, schedule)) {
      Candidate.findAll({
        where: { scheduleId: schedule.scheduleId },
        order: '"candidateId" ASC'
      }).then((candidates) => {
        res.render('edit', {
          user: req.user,
          schedule: schedule,
          candidates: candidates,
          csrfToken: req.csrfToken()
        });
      });
    } else {
      const err = new Error('指定された予定がない、または、予定する権限がありません');
      err.status = 404;
      next(err);
    }
  });
});

router.post('/:scheduleId', authenticationEnsurer, csrfProtection, (req, res, next) => {
  if (parseInt(req.query.edit) === 1) {
    Schedule.findOne({
      where: {
        scheduleId: req.params.scheduleId
      }
    }).then((schedule) => {
      if (isMine(req, schedule)) {
        const updatedAt = new Date();
        schedule.update({
          scheduleId: schedule.scheduleId,
          scheduleName: req.body.scheduleName.slice(0, 255),
          memo: req.body.memo,
          createdBy: req.user.id,
          updatedAt: updatedAt
        }).then((schedule) => {
          Candidate.findAll({
            where: { scheduleId: schedule.scheduleId },
            order: '"candidateId" ASC'
          }).then((candidates) => {
            const candidateNames = parseCandidateNames(req);
            if (candidateNames) {
              createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res);
            } else {
              res.redirect('/schedules/' + schedule.scheduleId);
            }
          });
        });
      } else {
        const err = new Error('指定された予定がない、または、編集する権限がありません');
        err.status = 404;
        next(err);
      }
    });
  } else if (parseInt(req.query.delete) === 1) {
    deleteScheduleAggregate(req.params.scheduleId, () => {
      res.redirect('/');
    });
  } else {
    const err = new Error('不正なリクエストです');
    err.status = 400;
    next(err);
  }
});

function isMine(req, schedule) {
  return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id);
}

function createCandidatesAndRedirect(candidateNames, scheduleId, res) {
  const candidates = candidateNames.map((c) => { return {
    candidateName: c,
    scheduleId: scheduleId
  };});
  Candidate.bulkCreate(candidates).then(() => {
    res.redirect('/schedules/' + scheduleId);
  });
}

function parseCandidateNames(req) {
  return req.body.candidates.trim().split('\n').map((s) => s.trim());
}

function deleteScheduleAggregate(scheduleId, done, err) {
  const promiseCommentDestroy = Comment.findAll({
    where: { scheduleId: scheduleId }
  }).then((comments) => {
    return Promise.all(comments.map((c) => { return c.destroy(); }));
  });

  Availability.findAll({
    where: { scheduleId: scheduleId }
  }).then((availabilities) => {
    const promises = availabilities.map((a) => { return a.destroy(); });
    return Promise.all(promises);
  }).then(() => {
    return Candidate.findAll({
      where: { scheduleId: scheduleId }
    });
  }).then((candidates) => {
    const promises = candidates.map((c) => { return c.destroy(); });
    promises.push(promiseCommentDestroy);
    return Promise.all(promises);
  }).then(() => {
    Schedule.findById(scheduleId).then((s) => { s.destroy(); });
    if (err) return done(err);
    done();
  });
}

router.deleteScheduleAggregate = deleteScheduleAggregate;

module.exports = router;

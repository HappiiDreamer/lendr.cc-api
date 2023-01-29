const router = require('express').Router();
const { Member, Loan } = require('../../models/all');
const { secure } = require('../secure');

/**
 * 
 * @param {string[]} names
 * @returns {string[]|false}
 */
async function getIdsFromNames(names) {
  if (names instanceof Array && names.length > 0) {
    let ids = [];
    for (let i = 0; i < names.length; i++) {
      const member = await Member.findOne({ username: names[i] });
      if (member == null) {
        return false;
      }
      else {
        ids.push(member.id);
      }
    }
    return ids;
  }
  else {
    return false;
  }
}
router.post('/create', async (req, res) => {
  const member = await secure(req, res, {
    requireAdmin: true
  });
  if (member) {
    // Check for required data
    if (!req.body.memo) {
      res.status(400).send({ err: "Invalid memo." });
      return;
    }
    if (!req.body.principal) {
      res.status(400).send({ err: "Invalid principal." });
      return;
    }

    // Convert borrower usernames to ids.
    const borrowers = await getIdsFromNames(req.body.borrowers);
    if (!borrowers) {
      res.status(400).send({ err: 'Invalid borrowers.' });
      return;
    }

    // Create the loan.
    const loan = new Loan({
      memo: req.body.memo,
      borrowers: borrowers
    });
    loan.records.push({
      amount: req.body.principal,
      type: 'principal'
    });

    try {
      await loan.save();
      res.send(loan);
    }
    catch (err) {
      res.status(501).send({ err: err });
    }
  }
});

/**
 * Gets and updates a loan.
 * @param {string} id 
 */
async function getAndUpdateLoan(id) {
  const loan = await Loan.findById(id);
  if (loan == null) {
    return null;
  }
  
  await loan.chargeInterest();
  return loan;
}

router.get('/:id', async (req, res) => {
  const member = await secure(req, res);
  if (member) {
    // Get loan.
    const loan = await getAndUpdateLoan(req.params.id);
    if (loan == null) {
      res.status(404).send({ err: 'Loan does not exist.' });
      return;
    }

    // Make sure logged in member has access.
    if (member.role != "admin") {
      let valid = false;
      loan.borrowers.forEach(id => {
        if (valid || id == member.id) {
          valid = true;
        }
      });
      if (!valid) {
        res.status(403).send({ err: 'Access denied.' });
        return;
      }
    }

    // Send loan.
    res.send(loan);
  }
});

router.post('/:id/post', async (req, res) => {
  const member = await secure(req, res, {
    requireAdmin: true
  });
  if (member) {
    // Get loan.
    const loan = await getAndUpdateLoan(req.params.id);
    if (loan == null) {
      res.status(404).send({ err: 'Loan does not exist.' });
      return;
    }

    loan.records.push(req.body);
    try {
      await loan.save();
      res.send(loan.records[loan.records.length - 1]);
    }
    catch (err) {
      res.status(501).send({ err: err });
    }
  }
});

module.exports = router;
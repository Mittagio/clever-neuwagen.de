import { Router } from 'express';
import { fetchDealerGoogleReviews } from './googlePlacesService.js';

const router = Router();

router.get('/dealers/:slug/google-reviews', async (req, res) => {
  try {
    const data = await fetchDealerGoogleReviews(req.params.slug);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
